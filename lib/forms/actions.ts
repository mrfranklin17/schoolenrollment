"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/tenant";
import { formSchemaSchema } from "@/lib/forms/schema";

export type FormActionState = { error?: string; ok?: boolean; templateId?: string } | undefined;

const createTemplateSchema = z.object({
  school: z.string().min(1),
  name: z.string().min(2, "Form name is required"),
  periodId: z.string().uuid().optional(),
  gradeLevels: z.string().optional(), // comma-separated; empty = all grades
});

export async function createFormTemplate(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const parsed = createTemplateSchema.safeParse({
    school: formData.get("school"),
    name: formData.get("name"),
    periodId: formData.get("periodId") || undefined,
    gradeLevels: formData.get("gradeLevels") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const { tenant } = await requireStaff(parsed.data.school);
  const supabase = await createClient();

  const gradeLevels = parsed.data.gradeLevels
    ? parsed.data.gradeLevels.split(",").map((g) => g.trim()).filter(Boolean)
    : null;

  const { data: template, error } = await supabase
    .from("form_templates")
    .insert({
      tenant_id: tenant.id,
      period_id: parsed.data.periodId ?? null,
      name: parsed.data.name,
      grade_levels: gradeLevels,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !template) return { error: "Could not create the form" };

  // Start version 1 as an editable draft with a sensible default schema.
  const { error: versionError } = await supabase.from("form_versions").insert({
    tenant_id: tenant.id,
    template_id: template.id,
    version: 1,
    schema: {
      title: parsed.data.name,
      description: "",
      fields: [],
    },
  });
  if (versionError) return { error: "Could not create the form draft" };

  revalidatePath(`/s/${parsed.data.school}/admin/forms`);
  return { ok: true, templateId: template.id };
}

const saveDraftSchema = z.object({
  school: z.string().min(1),
  templateId: z.string().uuid(),
  schema: formSchemaSchema,
});

export async function saveFormDraft(input: {
  school: string;
  templateId: string;
  schema: unknown;
}): Promise<FormActionState> {
  const parsed = saveDraftSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid form schema" };

  const { tenant } = await requireStaff(parsed.data.school);
  const supabase = await createClient();

  // Find the current draft (unpublished) version, or compute the next number.
  const { data: versions } = await supabase
    .from("form_versions")
    .select("id, version, published_at")
    .eq("template_id", parsed.data.templateId)
    .eq("tenant_id", tenant.id)
    .order("version", { ascending: false })
    .limit(1)
    .overrideTypes<{ id: string; version: number; published_at: string | null }[]>();

  const latest = versions?.[0];

  if (latest && latest.published_at === null) {
    const { error } = await supabase
      .from("form_versions")
      .update({ schema: parsed.data.schema })
      .eq("id", latest.id);
    if (error) return { error: "Could not save the draft" };
  } else {
    const { error } = await supabase.from("form_versions").insert({
      tenant_id: tenant.id,
      template_id: parsed.data.templateId,
      version: (latest?.version ?? 0) + 1,
      schema: parsed.data.schema,
    });
    if (error) return { error: "Could not save the draft" };
  }

  revalidatePath(`/s/${parsed.data.school}/admin/forms/${parsed.data.templateId}`);
  return { ok: true };
}

export async function publishFormDraft(input: {
  school: string;
  templateId: string;
}): Promise<FormActionState> {
  const schema = z.object({ school: z.string().min(1), templateId: z.string().uuid() });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "Invalid request" };

  const { tenant } = await requireStaff(parsed.data.school);
  const supabase = await createClient();

  const { data: draft } = await supabase
    .from("form_versions")
    .select("id, schema")
    .eq("template_id", parsed.data.templateId)
    .eq("tenant_id", tenant.id)
    .is("published_at", null)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; schema: unknown }>();

  if (!draft) return { error: "No draft to publish" };

  const valid = formSchemaSchema.safeParse(draft.schema);
  if (!valid.success) return { error: "Form has invalid fields; fix them before publishing" };
  if (valid.data.fields.length === 0) return { error: "Add at least one field before publishing" };

  const { error } = await supabase
    .from("form_versions")
    .update({ published_at: new Date().toISOString() })
    .eq("id", draft.id);

  if (error) return { error: "Could not publish the form" };

  revalidatePath(`/s/${parsed.data.school}/admin/forms/${parsed.data.templateId}`);
  return { ok: true };
}
