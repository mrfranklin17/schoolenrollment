"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/tenant";
import { sendTemplatedEmail } from "@/lib/email/send";

export type PipelineActionState = { error?: string; ok?: boolean; moved?: number } | undefined;

const moveSchema = z.object({
  school: z.string().min(1),
  applicationIds: z.array(z.string().uuid()).min(1),
  stageId: z.string().uuid(),
  notify: z.boolean().default(false),
});

export async function moveApplications(input: {
  school: string;
  applicationIds: string[];
  stageId: string;
  notify?: boolean;
}): Promise<PipelineActionState> {
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  const { tenant } = await requireStaff(parsed.data.school);
  const supabase = await createClient();

  const { data: stage } = await supabase
    .from("pipeline_stages")
    .select("id, key, label, category")
    .eq("id", parsed.data.stageId)
    .eq("tenant_id", tenant.id)
    .maybeSingle<{ id: string; key: string; label: string; category: string }>();
  if (!stage) return { error: "Unknown stage" };

  const { data: applications } = await supabase
    .from("applications")
    .select("id, stage_id, pipeline_stages ( key )")
    .eq("tenant_id", tenant.id)
    .in("id", parsed.data.applicationIds)
    .overrideTypes<{ id: string; stage_id: string; pipeline_stages: { key: string } | null }[]>();

  let moved = 0;
  for (const app of applications ?? []) {
    if (app.stage_id === stage.id) continue;
    const { error } = await supabase
      .from("applications")
      .update({ stage_id: stage.id })
      .eq("id", app.id);
    if (error) continue;
    moved++;

    await supabase.rpc("log_audit", {
      p_tenant_id: tenant.id,
      p_entity_type: "application",
      p_entity_id: app.id,
      p_action: "stage_changed",
      p_before: { stage: app.pipeline_stages?.key ?? app.stage_id },
      p_after: { stage: stage.key },
    });

    if (parsed.data.notify) {
      await sendTemplatedEmail({
        tenantId: tenant.id,
        applicationId: app.id,
        templateKey: "status_changed",
        fallbackSubject: `Application update from {{school_name}}`,
        fallbackBody:
          "Hi {{guardian_name}},\n\nThe application for {{student_first_name}} has moved to: {{stage_label}}.\n\nSign in to your family portal for details.\n\n— {{school_name}}",
        extraMergeFields: { stage_label: stage.label },
      });
    }
  }

  revalidatePath(`/s/${parsed.data.school}/admin`);
  return { ok: true, moved };
}

const noteSchema = z.object({
  school: z.string().min(1),
  applicationId: z.string().uuid(),
  body: z.string().min(1, "Note cannot be empty").max(5000),
});

export async function addNote(_prev: PipelineActionState, formData: FormData): Promise<PipelineActionState> {
  const parsed = noteSchema.safeParse({
    school: formData.get("school"),
    applicationId: formData.get("applicationId"),
    body: formData.get("body"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const { tenant, user } = await requireStaff(parsed.data.school);
  const supabase = await createClient();

  const { error } = await supabase.from("application_notes").insert({
    tenant_id: tenant.id,
    application_id: parsed.data.applicationId,
    author_id: user.id,
    body: parsed.data.body,
  });

  if (error) return { error: "Could not add the note" };
  revalidatePath(`/s/${parsed.data.school}/admin/applications/${parsed.data.applicationId}`);
  return { ok: true };
}

const waiverSchema = z.object({
  school: z.string().min(1),
  applicationId: z.string().uuid(),
  waived: z.boolean(),
});

export async function setFeeWaiver(input: {
  school: string;
  applicationId: string;
  waived: boolean;
}): Promise<PipelineActionState> {
  const parsed = waiverSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  const { tenant } = await requireStaff(parsed.data.school);
  const supabase = await createClient();

  const { error } = await supabase
    .from("applications")
    .update({
      fee_waived: parsed.data.waived,
      payment_status: parsed.data.waived ? "waived" : "not_required",
    })
    .eq("id", parsed.data.applicationId)
    .eq("tenant_id", tenant.id);

  if (error) return { error: "Could not update the fee waiver" };

  await supabase.rpc("log_audit", {
    p_tenant_id: tenant.id,
    p_entity_type: "application",
    p_entity_id: parsed.data.applicationId,
    p_action: "fee_waiver_changed",
    p_after: { fee_waived: parsed.data.waived },
  });

  revalidatePath(`/s/${parsed.data.school}/admin/applications/${parsed.data.applicationId}`);
  return { ok: true };
}
