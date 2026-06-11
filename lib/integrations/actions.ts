"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/tenant";

export type ImportActionState =
  | { error?: string; ok?: boolean; stats?: { created: number; updated: number; skipped: number } }
  | undefined;

const importSchema = z.object({
  school: z.string().min(1),
  fileName: z.string().min(1).max(255),
  mapping: z.record(z.string(), z.number().int().min(0)),
  rows: z.array(z.array(z.string())).min(1, "The file has no data rows").max(5000),
});

export async function importRoster(input: {
  school: string;
  fileName: string;
  mapping: Record<string, number>;
  rows: string[][];
}): Promise<ImportActionState> {
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid import" };

  const { school, fileName, mapping, rows } = parsed.data;
  if (mapping.first_name === undefined || mapping.last_name === undefined) {
    return { error: "Map at least First name and Last name columns" };
  }

  const { tenant } = await requireStaff(school);
  const supabase = await createClient();

  const { data: job } = await supabase
    .from("import_jobs")
    .insert({
      tenant_id: tenant.id,
      kind: "roster",
      file_name: fileName,
      column_mapping: mapping,
      status: "processing",
    })
    .select("id")
    .single<{ id: string }>();

  const cell = (row: string[], field: string): string | null => {
    const index = mapping[field];
    if (index === undefined) return null;
    const value = row[index]?.trim();
    return value || null;
  };

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const firstName = cell(row, "first_name");
    const lastName = cell(row, "last_name");
    if (!firstName || !lastName) {
      skipped++;
      continue;
    }
    const sisId = cell(row, "sis_id");
    const guardianEmail = cell(row, "guardian_email")?.toLowerCase() ?? null;
    const dob = cell(row, "date_of_birth");
    const grade = cell(row, "grade");

    // One family per guardian email (re-enrollment claim key).
    let familyId: string | null = null;
    if (guardianEmail) {
      const { data: existingFamily } = await supabase
        .from("families")
        .select("id")
        .eq("tenant_id", tenant.id)
        .ilike("invite_email", guardianEmail)
        .maybeSingle<{ id: string }>();
      familyId = existingFamily?.id ?? null;
    }
    if (!familyId) {
      const { data: family } = await supabase
        .from("families")
        .insert({
          tenant_id: tenant.id,
          name: `${lastName} Family`,
          invite_email: guardianEmail,
        })
        .select("id")
        .single<{ id: string }>();
      familyId = family?.id ?? null;
    }
    if (!familyId) {
      skipped++;
      continue;
    }

    // Match returning students by SIS id when available.
    let existingId: string | null = null;
    if (sisId) {
      const { data: existing } = await supabase
        .from("students")
        .select("id")
        .eq("tenant_id", tenant.id)
        .eq("sis_id", sisId)
        .maybeSingle<{ id: string }>();
      existingId = existing?.id ?? null;
    }

    if (existingId) {
      const { error } = await supabase
        .from("students")
        .update({
          first_name: firstName,
          last_name: lastName,
          date_of_birth: dob,
          current_grade: grade,
          is_returning: true,
        })
        .eq("id", existingId);
      if (error) skipped++;
      else updated++;
    } else {
      const { error } = await supabase.from("students").insert({
        tenant_id: tenant.id,
        family_id: familyId,
        first_name: firstName,
        last_name: lastName,
        date_of_birth: dob,
        current_grade: grade,
        sis_id: sisId,
        is_returning: true,
      });
      if (error) skipped++;
      else created++;
    }
  }

  const stats = { created, updated, skipped };
  if (job) {
    await supabase
      .from("import_jobs")
      .update({ status: "completed", stats })
      .eq("id", job.id);
  }

  revalidatePath(`/s/${school}/admin/data`);
  return { ok: true, stats };
}

const saveMappingSchema = z.object({
  school: z.string().min(1),
  name: z.string().min(1).max(100),
  fields: z.array(z.string()).min(1),
});

export async function saveExportMapping(input: {
  school: string;
  name: string;
  fields: string[];
}): Promise<ImportActionState> {
  const parsed = saveMappingSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid mapping" };

  const { tenant } = await requireStaff(parsed.data.school);
  const supabase = await createClient();

  const { error } = await supabase.from("export_mappings").insert({
    tenant_id: tenant.id,
    name: parsed.data.name,
    kind: "flat_csv",
    mapping: { fields: parsed.data.fields },
  });

  if (error) return { error: "Could not save the mapping" };
  revalidatePath(`/s/${parsed.data.school}/admin/data`);
  return { ok: true };
}
