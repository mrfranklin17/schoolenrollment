"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/tenant";

export type ActionState = { error?: string; ok?: boolean } | undefined;

const periodSchema = z.object({
  school: z.string().min(1),
  academicYear: z.string().min(4, "Academic year is required"),
  name: z.string().min(2, "Name is required"),
  opensAt: z.string().optional(),
  closesAt: z.string().optional(),
});

export async function createPeriod(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = periodSchema.safeParse({
    school: formData.get("school"),
    academicYear: formData.get("academicYear"),
    name: formData.get("name"),
    opensAt: formData.get("opensAt") || undefined,
    closesAt: formData.get("closesAt") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const { tenant } = await requireStaff(parsed.data.school);
  const supabase = await createClient();

  const { error } = await supabase.from("enrollment_periods").insert({
    tenant_id: tenant.id,
    academic_year: parsed.data.academicYear,
    name: parsed.data.name,
    opens_at: parsed.data.opensAt ? new Date(parsed.data.opensAt).toISOString() : null,
    closes_at: parsed.data.closesAt ? new Date(parsed.data.closesAt).toISOString() : null,
  });

  if (error) return { error: "Could not create the enrollment period" };
  revalidatePath(`/s/${parsed.data.school}/admin/settings`);
  return { ok: true };
}

const capacitySchema = z.object({
  school: z.string().min(1),
  periodId: z.string().uuid(),
  grade: z.string().min(1),
  seats: z.coerce.number().int().min(0),
});

export async function setGradeCapacity(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = capacitySchema.safeParse({
    school: formData.get("school"),
    periodId: formData.get("periodId"),
    grade: formData.get("grade"),
    seats: formData.get("seats"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const { tenant } = await requireStaff(parsed.data.school);
  const supabase = await createClient();

  const { error } = await supabase
    .from("grade_capacities")
    .upsert(
      {
        tenant_id: tenant.id,
        period_id: parsed.data.periodId,
        grade: parsed.data.grade,
        seats: parsed.data.seats,
      },
      { onConflict: "period_id,grade" }
    );

  if (error) return { error: "Could not save capacity" };
  revalidatePath(`/s/${parsed.data.school}/admin/settings`);
  return { ok: true };
}

const requirementSchema = z.object({
  school: z.string().min(1),
  periodId: z.string().uuid().optional(),
  name: z.string().min(2, "Name is required"),
  description: z.string().optional(),
  required: z.boolean(),
});

export async function createDocumentRequirement(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = requirementSchema.safeParse({
    school: formData.get("school"),
    periodId: formData.get("periodId") || undefined,
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    required: formData.get("required") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const { tenant } = await requireStaff(parsed.data.school);
  const supabase = await createClient();

  const { count } = await supabase
    .from("document_requirements")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenant.id);

  const { error } = await supabase.from("document_requirements").insert({
    tenant_id: tenant.id,
    period_id: parsed.data.periodId ?? null,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    required: parsed.data.required,
    position: count ?? 0,
  });

  if (error) return { error: "Could not create the checklist item" };
  revalidatePath(`/s/${parsed.data.school}/admin/settings`);
  return { ok: true };
}
