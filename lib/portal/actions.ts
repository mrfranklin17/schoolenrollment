"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getTenantBySlug, requireUser } from "@/lib/tenant";
import { formSchemaSchema, validateResponses, type FormResponses } from "@/lib/forms/schema";
import { sendTemplatedEmail } from "@/lib/email/send";

export type PortalActionState =
  | { error?: string; ok?: boolean; fieldErrors?: Record<string, string> }
  | undefined;

const studentSchema = z.object({
  school: z.string().min(1),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  dateOfBirth: z.string().optional(),
  currentGrade: z.string().optional(),
});

export async function addStudent(
  _prev: PortalActionState,
  formData: FormData
): Promise<PortalActionState> {
  const parsed = studentSchema.safeParse({
    school: formData.get("school"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    dateOfBirth: formData.get("dateOfBirth") || undefined,
    currentGrade: formData.get("currentGrade") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const tenant = await getTenantBySlug(parsed.data.school);
  await requireUser(`/s/${parsed.data.school}/portal`);
  const supabase = await createClient();

  const { data: familyId, error: famError } = await supabase.rpc("ensure_guardian_family", {
    p_tenant_id: tenant.id,
    p_family_name: null,
  });
  if (famError || !familyId) return { error: "Could not set up your family profile" };

  const { error } = await supabase.from("students").insert({
    tenant_id: tenant.id,
    family_id: familyId,
    first_name: parsed.data.firstName,
    last_name: parsed.data.lastName,
    date_of_birth: parsed.data.dateOfBirth || null,
    current_grade: parsed.data.currentGrade || null,
  });

  if (error) return { error: "Could not add the student" };
  revalidatePath(`/s/${parsed.data.school}/portal`);
  return { ok: true };
}

const startSchema = z.object({
  school: z.string().min(1),
  studentId: z.string().uuid("Choose a student"),
  periodId: z.string().uuid("Choose an enrollment period"),
  grade: z.string().min(1, "Choose a grade"),
});

export async function startApplication(
  _prev: PortalActionState,
  formData: FormData
): Promise<PortalActionState> {
  const parsed = startSchema.safeParse({
    school: formData.get("school"),
    studentId: formData.get("studentId"),
    periodId: formData.get("periodId"),
    grade: formData.get("grade"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const { school, studentId, periodId, grade } = parsed.data;
  const tenant = await getTenantBySlug(school);
  await requireUser(`/s/${school}/portal`);
  const supabase = await createClient();

  // The student must belong to the caller's family (RLS would also block).
  const { data: student } = await supabase
    .from("students")
    .select("id, family_id")
    .eq("id", studentId)
    .eq("tenant_id", tenant.id)
    .maybeSingle<{ id: string; family_id: string }>();
  if (!student) return { error: "Student not found" };

  // Pick the published form for this period that covers the grade:
  // prefer a grade-specific variant over an all-grades form.
  const { data: templates } = await supabase
    .from("form_templates")
    .select("id, grade_levels, period_id, form_versions ( id, version, published_at )")
    .eq("tenant_id", tenant.id)
    .or(`period_id.eq.${periodId},period_id.is.null`)
    .overrideTypes<
      {
        id: string;
        grade_levels: string[] | null;
        period_id: string | null;
        form_versions: { id: string; version: number; published_at: string | null }[];
      }[]
    >();

  const candidates = (templates ?? [])
    .map((t) => ({
      ...t,
      published: t.form_versions
        .filter((v) => v.published_at)
        .sort((a, b) => b.version - a.version)[0],
    }))
    .filter((t) => t.published)
    .filter((t) => !t.grade_levels?.length || t.grade_levels.includes(grade))
    // grade-specific beats all-grades; period-specific beats no-period
    .sort(
      (a, b) =>
        Number(!!b.grade_levels?.length) - Number(!!a.grade_levels?.length) ||
        Number(!!b.period_id) - Number(!!a.period_id)
    );

  const chosen = candidates[0];
  if (!chosen) {
    return { error: "This school hasn't published an application form for that grade yet." };
  }

  const { data: stage } = await supabase
    .from("pipeline_stages")
    .select("id")
    .eq("tenant_id", tenant.id)
    .eq("category", "in_progress")
    .order("position")
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (!stage) return { error: "School pipeline is not configured" };

  const { data: application, error } = await supabase
    .from("applications")
    .insert({
      tenant_id: tenant.id,
      period_id: periodId,
      family_id: student.family_id,
      student_id: studentId,
      form_version_id: chosen.published!.id,
      grade_applying: grade,
      stage_id: stage.id,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    if (error.code === "23505") {
      return { error: "An application for this student already exists for this period." };
    }
    return { error: "Could not start the application" };
  }

  await supabase.rpc("log_audit", {
    p_tenant_id: tenant.id,
    p_entity_type: "application",
    p_entity_id: application.id,
    p_action: "created",
    p_after: { stage: "started", grade },
  });

  redirect(`/s/${school}/portal/applications/${application.id}`);
}

const saveDraftSchema = z.object({
  school: z.string().min(1),
  applicationId: z.string().uuid(),
  responses: z.record(z.string(), z.unknown()),
});

export async function saveApplicationDraft(input: {
  school: string;
  applicationId: string;
  responses: FormResponses;
}): Promise<PortalActionState> {
  const parsed = saveDraftSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  await requireUser(`/s/${parsed.data.school}/portal`);
  const supabase = await createClient();

  // RLS allows guardians to update only their own unsubmitted applications.
  const { error } = await supabase
    .from("applications")
    .update({ responses: parsed.data.responses })
    .eq("id", parsed.data.applicationId)
    .is("submitted_at", null);

  if (error) return { error: "Could not save your draft" };
  return { ok: true };
}

export async function submitApplication(input: {
  school: string;
  applicationId: string;
  responses: FormResponses;
}): Promise<PortalActionState> {
  const parsed = saveDraftSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  const { school, applicationId } = parsed.data;
  const tenant = await getTenantBySlug(school);
  await requireUser(`/s/${school}/portal`);
  const supabase = await createClient();

  const { data: application } = await supabase
    .from("applications")
    .select("id, submitted_at, form_version_id, period_id")
    .eq("id", applicationId)
    .maybeSingle<{
      id: string;
      submitted_at: string | null;
      form_version_id: string;
      period_id: string;
    }>();
  if (!application) return { error: "Application not found" };
  if (application.submitted_at) return { error: "This application was already submitted" };

  const { data: version } = await supabase
    .from("form_versions")
    .select("schema")
    .eq("id", application.form_version_id)
    .maybeSingle<{ schema: unknown }>();

  const formSchema = version ? formSchemaSchema.safeParse(version.schema) : null;
  if (!formSchema?.success) return { error: "Form definition could not be loaded" };

  const responses = parsed.data.responses as FormResponses;
  const fieldErrors = validateResponses(formSchema.data, responses);
  if (Object.keys(fieldErrors).length > 0) {
    return { error: "Please fix the highlighted fields", fieldErrors };
  }

  const { data: stage } = await supabase
    .from("pipeline_stages")
    .select("id, key")
    .eq("tenant_id", tenant.id)
    .eq("category", "submitted")
    .order("position")
    .limit(1)
    .maybeSingle<{ id: string; key: string }>();
  if (!stage) return { error: "School pipeline is not configured" };

  const { error } = await supabase
    .from("applications")
    .update({
      responses,
      submitted_at: new Date().toISOString(),
      stage_id: stage.id,
    })
    .eq("id", applicationId)
    .is("submitted_at", null);

  if (error) return { error: "Could not submit the application" };

  // Seed the document checklist for this application.
  const { data: requirements } = await supabase
    .from("document_requirements")
    .select("id, period_id")
    .eq("tenant_id", tenant.id)
    .overrideTypes<{ id: string; period_id: string | null }[]>();

  const relevant = (requirements ?? []).filter(
    (r) => !r.period_id || r.period_id === application.period_id
  );
  if (relevant.length > 0) {
    await supabase.from("application_documents").upsert(
      relevant.map((r) => ({
        tenant_id: tenant.id,
        application_id: applicationId,
        requirement_id: r.id,
      })),
      { onConflict: "application_id,requirement_id", ignoreDuplicates: true }
    );
  }

  await supabase.rpc("log_audit", {
    p_tenant_id: tenant.id,
    p_entity_type: "application",
    p_entity_id: applicationId,
    p_action: "submitted",
    p_after: { stage: stage.key },
  });

  await sendTemplatedEmail({
    tenantId: tenant.id,
    applicationId,
    templateKey: "submission_received",
    fallbackSubject: "We received your application — {{school_name}}",
    fallbackBody:
      "Hi {{guardian_name}},\n\nThanks! We received the application for {{student_first_name}} (grade {{grade}}, {{period_name}}).\n\nNext step: upload any required documents in your family portal: {{portal_url}}\n\n— {{school_name}}",
  });

  revalidatePath(`/s/${school}/portal/applications/${applicationId}`);
  return { ok: true };
}
