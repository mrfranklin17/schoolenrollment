"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/tenant";
import { sendTemplatedEmail } from "@/lib/email/send";

export type CommsActionState = { error?: string; ok?: boolean; sent?: number } | undefined;

const templateSchema = z.object({
  school: z.string().min(1),
  key: z.string().min(1),
  name: z.string().min(1),
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Body is required"),
});

export async function upsertEmailTemplate(
  _prev: CommsActionState,
  formData: FormData
): Promise<CommsActionState> {
  const parsed = templateSchema.safeParse({
    school: formData.get("school"),
    key: formData.get("key"),
    name: formData.get("name"),
    subject: formData.get("subject"),
    body: formData.get("body"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const { tenant } = await requireStaff(parsed.data.school);
  const supabase = await createClient();

  const { error } = await supabase.from("email_templates").upsert(
    {
      tenant_id: tenant.id,
      key: parsed.data.key,
      name: parsed.data.name,
      subject: parsed.data.subject,
      body: parsed.data.body,
    },
    { onConflict: "tenant_id,key" }
  );

  if (error) return { error: "Could not save the template" };
  revalidatePath(`/s/${parsed.data.school}/admin/communications`);
  return { ok: true };
}

const bulkSchema = z.object({
  school: z.string().min(1),
  stageId: z.string().uuid("Choose a stage"),
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Body is required"),
});

export async function sendBulkEmail(
  _prev: CommsActionState,
  formData: FormData
): Promise<CommsActionState> {
  const parsed = bulkSchema.safeParse({
    school: formData.get("school"),
    stageId: formData.get("stageId"),
    subject: formData.get("subject"),
    body: formData.get("body"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const { tenant } = await requireStaff(parsed.data.school);
  const supabase = await createClient();

  const { data: applications } = await supabase
    .from("applications")
    .select("id")
    .eq("tenant_id", tenant.id)
    .eq("stage_id", parsed.data.stageId)
    .overrideTypes<{ id: string }[]>();

  let sent = 0;
  for (const app of applications ?? []) {
    // "bulk" is not a stored template key, so the typed subject/body are used
    // verbatim (merge fields still render per recipient).
    await sendTemplatedEmail({
      tenantId: tenant.id,
      applicationId: app.id,
      templateKey: "bulk",
      fallbackSubject: parsed.data.subject,
      fallbackBody: parsed.data.body,
    });
    sent++;
  }

  revalidatePath(`/s/${parsed.data.school}/admin/communications`);
  return { ok: true, sent };
}
