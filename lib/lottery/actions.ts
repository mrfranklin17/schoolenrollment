"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getTenantBySlug, requireStaff, requireUser } from "@/lib/tenant";
import { sendTemplatedEmail } from "@/lib/email/send";
import { preferencesFromResponses, runLotteryDraw } from "@/lib/lottery/run";

export type LotteryActionState = { error?: string; ok?: boolean } | undefined;

const createSchema = z.object({
  school: z.string().min(1),
  periodId: z.string().uuid("Choose a period"),
  grade: z.string().min(1, "Choose a grade"),
  seed: z.string().min(8).optional(),
  siblingWeight: z.coerce.number().min(1).default(2),
  staffChildWeight: z.coerce.number().min(1).default(2),
  zoneWeight: z.coerce.number().min(1).default(1),
});

export async function createLottery(
  _prev: LotteryActionState,
  formData: FormData
): Promise<LotteryActionState> {
  const parsed = createSchema.safeParse({
    school: formData.get("school"),
    periodId: formData.get("periodId"),
    grade: formData.get("grade"),
    seed: formData.get("seed") || undefined,
    siblingWeight: formData.get("siblingWeight") || 2,
    staffChildWeight: formData.get("staffChildWeight") || 2,
    zoneWeight: formData.get("zoneWeight") || 1,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const { tenant } = await requireStaff(parsed.data.school);
  const supabase = await createClient();

  const { error } = await supabase.from("lotteries").insert({
    tenant_id: tenant.id,
    period_id: parsed.data.periodId,
    grade: parsed.data.grade,
    seed: parsed.data.seed ?? randomBytes(16).toString("hex"),
    weights: {
      sibling: parsed.data.siblingWeight,
      staff_child: parsed.data.staffChildWeight,
      zone: parsed.data.zoneWeight,
    },
  });

  if (error) return { error: "Could not create the lottery" };
  revalidatePath(`/s/${parsed.data.school}/admin/lottery`);
  return { ok: true };
}

export async function runLottery(input: {
  school: string;
  lotteryId: string;
}): Promise<LotteryActionState> {
  const parsed = z
    .object({ school: z.string().min(1), lotteryId: z.string().uuid() })
    .safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  const { tenant } = await requireStaff(parsed.data.school);
  const supabase = await createClient();

  const { data: lottery } = await supabase
    .from("lotteries")
    .select("id, period_id, grade, seed, weights, status")
    .eq("id", parsed.data.lotteryId)
    .eq("tenant_id", tenant.id)
    .maybeSingle<{
      id: string;
      period_id: string;
      grade: string | null;
      seed: string;
      weights: Record<string, number>;
      status: string;
    }>();
  if (!lottery) return { error: "Lottery not found" };
  if (lottery.status === "finalized") return { error: "This lottery is finalized" };

  // Eligible: submitted (not draft) applications for the period/grade that
  // aren't already accepted/enrolled.
  const { data: stages } = await supabase
    .from("pipeline_stages")
    .select("id, key, category")
    .eq("tenant_id", tenant.id)
    .order("position")
    .overrideTypes<{ id: string; key: string; category: string }[]>();

  const eligibleStageIds = new Set(
    (stages ?? [])
      .filter((s) => ["submitted", "in_review"].includes(s.category))
      .map((s) => s.id)
  );
  const offeredStage = (stages ?? []).find((s) => s.category === "offered");
  const waitlistedStage = (stages ?? []).find((s) => s.category === "waitlisted");
  if (!offeredStage || !waitlistedStage) {
    return { error: "Pipeline needs an 'offered' and a 'waitlisted' stage" };
  }

  let query = supabase
    .from("applications")
    .select("id, responses, stage_id, grade_applying")
    .eq("tenant_id", tenant.id)
    .eq("period_id", lottery.period_id);
  if (lottery.grade) query = query.eq("grade_applying", lottery.grade);

  const { data: applications } = await query.overrideTypes<
    { id: string; responses: Record<string, unknown>; stage_id: string; grade_applying: string }[]
  >();

  const eligible = (applications ?? []).filter((a) => eligibleStageIds.has(a.stage_id));
  if (eligible.length === 0) return { error: "No eligible submitted applications to draw" };

  const weightKeys = Object.keys(lottery.weights ?? {});
  const results = runLotteryDraw(
    lottery.seed,
    eligible.map((a) => ({
      applicationId: a.id,
      preferences: preferencesFromResponses(a.responses ?? {}, weightKeys),
    })),
    lottery.weights ?? {}
  );

  // Seats for this grade in this period.
  let seats = 0;
  if (lottery.grade) {
    const { data: capacity } = await supabase
      .from("grade_capacities")
      .select("seats")
      .eq("period_id", lottery.period_id)
      .eq("grade", lottery.grade)
      .maybeSingle<{ seats: number }>();
    seats = capacity?.seats ?? 0;
  }
  if (seats <= 0) return { error: "Set a seat capacity for this grade before running" };

  // Replace any previous entries (rerun with same seed is identical anyway).
  await supabase.from("lottery_entries").delete().eq("lottery_id", lottery.id);
  const { error: entriesError } = await supabase.from("lottery_entries").insert(
    results.map((r) => ({
      tenant_id: tenant.id,
      lottery_id: lottery.id,
      application_id: r.applicationId,
      preferences: r.preferences,
      weight: r.weight,
      ticket: r.ticket,
      rank: r.rank,
    }))
  );
  if (entriesError) return { error: "Could not record lottery entries" };

  const winners = results.slice(0, seats);
  const waitlisted = results.slice(seats);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  for (const winner of winners) {
    await supabase
      .from("applications")
      .update({ stage_id: offeredStage.id })
      .eq("id", winner.applicationId);
    await supabase.from("offers").insert({
      tenant_id: tenant.id,
      application_id: winner.applicationId,
      expires_at: expiresAt,
    });
    await supabase.rpc("log_audit", {
      p_tenant_id: tenant.id,
      p_entity_type: "application",
      p_entity_id: winner.applicationId,
      p_action: "lottery_offered",
      p_after: { lottery_id: lottery.id, rank: winner.rank },
    });
    await sendTemplatedEmail({
      tenantId: tenant.id,
      applicationId: winner.applicationId,
      templateKey: "offer_extended",
      fallbackSubject: "You have an enrollment offer from {{school_name}}!",
      fallbackBody:
        "Hi {{guardian_name}},\n\nGreat news — {{student_first_name}} has been offered a seat for {{period_name}}. Please accept or decline in your family portal within 7 days: {{portal_url}}\n\n— {{school_name}}",
    });
  }

  if (lottery.grade) {
    await supabase
      .from("waitlist_positions")
      .delete()
      .eq("period_id", lottery.period_id)
      .eq("grade", lottery.grade);
  }
  let waitRank = 1;
  for (const entry of waitlisted) {
    await supabase
      .from("applications")
      .update({ stage_id: waitlistedStage.id })
      .eq("id", entry.applicationId);
    await supabase.from("waitlist_positions").insert({
      tenant_id: tenant.id,
      period_id: lottery.period_id,
      grade: lottery.grade ?? "all",
      application_id: entry.applicationId,
      rank: waitRank++,
    });
    await supabase.rpc("log_audit", {
      p_tenant_id: tenant.id,
      p_entity_type: "application",
      p_entity_id: entry.applicationId,
      p_action: "lottery_waitlisted",
      p_after: { lottery_id: lottery.id, rank: entry.rank },
    });
  }

  const { error: lotteryError } = await supabase
    .from("lotteries")
    .update({
      status: "run",
      run_at: new Date().toISOString(),
      results: {
        seats,
        entries: results.length,
        offered: winners.length,
        waitlisted: waitlisted.length,
        ranking: results.map((r) => ({ application_id: r.applicationId, rank: r.rank, weight: r.weight })),
      },
    })
    .eq("id", lottery.id);
  if (lotteryError) return { error: "Lottery ran but could not be saved" };

  revalidatePath(`/s/${parsed.data.school}/admin/lottery`);
  return { ok: true };
}

/** Extend an offer to the top of the waitlist (after a decline/expiry). */
export async function offerNextOnWaitlist(input: {
  school: string;
  periodId: string;
  grade: string;
}): Promise<LotteryActionState> {
  const parsed = z
    .object({ school: z.string().min(1), periodId: z.string().uuid(), grade: z.string().min(1) })
    .safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  const { tenant } = await requireStaff(parsed.data.school);
  const supabase = await createClient();

  const { data: top } = await supabase
    .from("waitlist_positions")
    .select("id, application_id")
    .eq("tenant_id", tenant.id)
    .eq("period_id", parsed.data.periodId)
    .eq("grade", parsed.data.grade)
    .order("rank")
    .limit(1)
    .maybeSingle<{ id: string; application_id: string }>();
  if (!top) return { error: "The waitlist is empty" };

  const { data: offeredStage } = await supabase
    .from("pipeline_stages")
    .select("id")
    .eq("tenant_id", tenant.id)
    .eq("category", "offered")
    .order("position")
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (!offeredStage) return { error: "Pipeline needs an 'offered' stage" };

  await supabase.from("waitlist_positions").delete().eq("id", top.id);
  await supabase
    .from("applications")
    .update({ stage_id: offeredStage.id })
    .eq("id", top.application_id);
  await supabase.from("offers").insert({
    tenant_id: tenant.id,
    application_id: top.application_id,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });
  await supabase.rpc("log_audit", {
    p_tenant_id: tenant.id,
    p_entity_type: "application",
    p_entity_id: top.application_id,
    p_action: "waitlist_offered",
    p_after: { period_id: parsed.data.periodId, grade: parsed.data.grade },
  });
  await sendTemplatedEmail({
    tenantId: tenant.id,
    applicationId: top.application_id,
    templateKey: "offer_extended",
    fallbackSubject: "A seat opened up at {{school_name}}!",
    fallbackBody:
      "Hi {{guardian_name}},\n\nA seat opened up and {{student_first_name}} is next on the waitlist. Please accept or decline in your family portal within 7 days: {{portal_url}}\n\n— {{school_name}}",
  });

  revalidatePath(`/s/${parsed.data.school}/admin/lottery`);
  return { ok: true };
}

/** Parent accepts or declines a pending offer. */
export async function respondToOffer(input: {
  school: string;
  offerId: string;
  response: "accepted" | "declined";
}): Promise<LotteryActionState> {
  const parsed = z
    .object({
      school: z.string().min(1),
      offerId: z.string().uuid(),
      response: z.enum(["accepted", "declined"]),
    })
    .safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  const tenant = await getTenantBySlug(parsed.data.school);
  await requireUser();
  const supabase = await createClient();

  const { data: offer } = await supabase
    .from("offers")
    .select("id, status, expires_at, application_id")
    .eq("id", parsed.data.offerId)
    .maybeSingle<{ id: string; status: string; expires_at: string | null; application_id: string }>();
  if (!offer) return { error: "Offer not found" };
  if (offer.status !== "pending") return { error: "This offer has already been resolved" };
  if (offer.expires_at && Date.parse(offer.expires_at) < Date.now()) {
    return { error: "This offer has expired — contact the school" };
  }

  const { error } = await supabase
    .from("offers")
    .update({ status: parsed.data.response, responded_at: new Date().toISOString() })
    .eq("id", offer.id)
    .eq("status", "pending");
  if (error) return { error: "Could not record your response" };

  // Move the application to the matching stage. Guardians can't update
  // submitted applications under RLS, so this goes through a definer RPC.
  await supabase.rpc("apply_offer_response", {
    p_application_id: offer.application_id,
    p_response: parsed.data.response,
  });

  await supabase.rpc("log_audit", {
    p_tenant_id: tenant.id,
    p_entity_type: "offer",
    p_entity_id: offer.id,
    p_action: `offer_${parsed.data.response}`,
    p_after: { application_id: offer.application_id },
  });

  revalidatePath(`/s/${parsed.data.school}/portal`);
  return { ok: true };
}
