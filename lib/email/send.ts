import "server-only";

import { Resend } from "resend";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Templated transactional email with per-tenant overrides.
 *
 * - Looks up the tenant's custom template by key; falls back to the provided
 *   default subject/body.
 * - Renders {{merge_fields}} from application/tenant context.
 * - Sends via Resend when RESEND_API_KEY is set; otherwise logs to the
 *   console (dev mode).
 * - Every send is recorded in email_log (per applicant).
 */

export interface SendTemplatedEmailInput {
  tenantId: string;
  applicationId: string;
  templateKey: string;
  fallbackSubject: string;
  fallbackBody: string;
  extraMergeFields?: Record<string, string>;
}

function render(template: string, fields: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, key: string) => fields[key] ?? "");
}

function db() {
  // Prefer the service-role client so guardian-triggered sends (e.g.
  // submission confirmations) can read recipients and write the send log.
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return createAdminClient();
  return null;
}

export async function sendTemplatedEmail(input: SendTemplatedEmailInput): Promise<void> {
  const admin = db();
  const supabase = admin ?? (await createClient());

  const { data: context } = await supabase
    .from("applications")
    .select(
      "id, grade_applying, family_id, students ( first_name ), tenants ( name, slug ), enrollment_periods ( name, academic_year )"
    )
    .eq("id", input.applicationId)
    .maybeSingle<{
      id: string;
      grade_applying: string;
      family_id: string;
      students: { first_name: string } | null;
      tenants: { name: string; slug: string } | null;
      enrollment_periods: { name: string; academic_year: string } | null;
    }>();
  if (!context) return;

  const { data: guardians } = await supabase
    .from("family_guardians")
    .select("user_id, profiles:user_id ( email, full_name )")
    .eq("family_id", context.family_id)
    .overrideTypes<{ user_id: string; profiles: { email: string; full_name: string | null } | null }[]>();

  const recipients = (guardians ?? [])
    .map((g) => g.profiles)
    .filter((p): p is { email: string; full_name: string | null } => !!p?.email);
  if (recipients.length === 0) return;

  const { data: template } = await supabase
    .from("email_templates")
    .select("subject, body")
    .eq("tenant_id", input.tenantId)
    .eq("key", input.templateKey)
    .maybeSingle<{ subject: string; body: string }>();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const baseFields: Record<string, string> = {
    school_name: context.tenants?.name ?? "",
    student_first_name: context.students?.first_name ?? "your student",
    grade: context.grade_applying,
    period_name: context.enrollment_periods?.name ?? "",
    academic_year: context.enrollment_periods?.academic_year ?? "",
    portal_url: `${appUrl}/s/${context.tenants?.slug ?? ""}/portal`,
    ...input.extraMergeFields,
  };

  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Enrollly <onboarding@resend.dev>";
  const resend = resendKey ? new Resend(resendKey) : null;

  for (const recipient of recipients) {
    const fields = { ...baseFields, guardian_name: recipient.full_name ?? "there" };
    const subject = render(template?.subject ?? input.fallbackSubject, fields);
    const body = render(template?.body ?? input.fallbackBody, fields);

    let status: "sent" | "failed" = "sent";
    let errorMessage: string | null = null;

    if (resend) {
      const { error } = await resend.emails.send({
        from,
        to: recipient.email,
        subject,
        text: body,
      });
      if (error) {
        status = "failed";
        errorMessage = error.message;
      }
    } else {
      // Dev mode: no provider configured. Do not log message bodies
      // (they can contain student names); subject + recipient is enough.
      console.log(`[email:dev] to=${recipient.email} subject="${subject}"`);
    }

    if (admin) {
      await admin.from("email_log").insert({
        tenant_id: input.tenantId,
        application_id: input.applicationId,
        recipient_email: recipient.email,
        template_key: input.templateKey,
        subject,
        status,
        error: errorMessage,
        sent_at: status === "sent" ? new Date().toISOString() : null,
      });
    }
  }
}
