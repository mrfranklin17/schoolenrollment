import { notFound } from "next/navigation";

import { requireStaff } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { formSchemaSchema, isFieldVisible, type FormField, type FormResponses } from "@/lib/forms/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentReviewList, NoteForm, StageControls } from "./detail-widgets";

export const metadata = { title: "Application detail" };

interface DetailRow {
  id: string;
  responses: FormResponses;
  submitted_at: string | null;
  created_at: string;
  grade_applying: string;
  stage_id: string;
  fee_waived: boolean;
  payment_status: string;
  form_version_id: string;
  students: { first_name: string; last_name: string; date_of_birth: string | null } | null;
  enrollment_periods: { name: string; academic_year: string } | null;
  families: { name: string } | null;
}

function ResponseValueDisplay({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === "")
    return <span className="text-muted-foreground">—</span>;
  if (typeof value === "boolean") return <span>{value ? "Yes" : "No"}</span>;
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground">—</span>;
    if (typeof value[0] === "string") return <span>{(value as string[]).join(", ")}</span>;
    return null;
  }
  return <span>{String(value)}</span>;
}

function ResponseFields({ fields, responses }: { fields: FormField[]; responses: FormResponses }) {
  return (
    <dl className="space-y-3">
      {fields.map((field) => {
        if (!isFieldVisible(field, responses)) return null;
        if (field.type === "section") {
          return (
            <dt key={field.key} className="border-b pb-1 pt-3 font-semibold">
              {field.label}
            </dt>
          );
        }
        if (field.type === "file") return null;
        if (field.type === "repeating") {
          const rows = Array.isArray(responses[field.key])
            ? (responses[field.key] as Record<string, unknown>[])
            : [];
          return (
            <div key={field.key}>
              <dt className="text-sm font-medium text-muted-foreground">{field.label}</dt>
              <dd className="mt-1 space-y-2">
                {rows.length === 0 && <span className="text-sm text-muted-foreground">—</span>}
                {rows.map((row, i) => (
                  <div key={i} className="rounded-md border p-3">
                    <ResponseFields
                      fields={field.fields ?? []}
                      responses={row as FormResponses}
                    />
                  </div>
                ))}
              </dd>
            </div>
          );
        }
        return (
          <div key={field.key} className="grid gap-1 sm:grid-cols-2">
            <dt className="text-sm font-medium text-muted-foreground">{field.label}</dt>
            <dd className="text-sm">
              <ResponseValueDisplay value={responses[field.key]} />
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ school: string; id: string }>;
}) {
  const { school, id } = await params;
  const { tenant } = await requireStaff(school);
  const supabase = await createClient();

  const { data: application } = await supabase
    .from("applications")
    .select(
      "id, responses, submitted_at, created_at, grade_applying, stage_id, fee_waived, payment_status, form_version_id, students ( first_name, last_name, date_of_birth ), enrollment_periods ( name, academic_year ), families ( name )"
    )
    .eq("id", id)
    .eq("tenant_id", tenant.id)
    .maybeSingle<DetailRow>();

  if (!application) notFound();

  const [{ data: version }, { data: stages }, { data: documents }, { data: notes }, { data: audit }] =
    await Promise.all([
      supabase
        .from("form_versions")
        .select("schema, version")
        .eq("id", application.form_version_id)
        .maybeSingle<{ schema: unknown; version: number }>(),
      supabase
        .from("pipeline_stages")
        .select("id, label")
        .eq("tenant_id", tenant.id)
        .order("position")
        .overrideTypes<{ id: string; label: string }[]>(),
      supabase
        .from("application_documents")
        .select(
          "id, status, file_name, rejection_reason, uploaded_at, document_requirements ( name, required )"
        )
        .eq("application_id", id)
        .overrideTypes<
          {
            id: string;
            status: string;
            file_name: string | null;
            rejection_reason: string | null;
            uploaded_at: string | null;
            document_requirements: { name: string; required: boolean } | null;
          }[]
        >(),
      supabase
        .from("application_notes")
        .select("id, body, created_at, profiles:author_id ( full_name, email )")
        .eq("application_id", id)
        .order("created_at", { ascending: false })
        .overrideTypes<
          { id: string; body: string; created_at: string; profiles: { full_name: string | null; email: string } | null }[]
        >(),
      supabase
        .from("audit_log")
        .select("id, action, before, after, created_at, entity_type")
        .eq("tenant_id", tenant.id)
        .eq("entity_id", id)
        .order("created_at", { ascending: false })
        .limit(50)
        .overrideTypes<
          { id: number; action: string; before: unknown; after: unknown; created_at: string; entity_type: string }[]
        >(),
    ]);

  const parsedSchema = version ? formSchemaSchema.safeParse(version.schema) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            {application.students
              ? `${application.students.first_name} ${application.students.last_name}`
              : "Application"}
          </h1>
          <p className="text-muted-foreground">
            Grade {application.grade_applying} · {application.enrollment_periods?.name} ·{" "}
            {application.families?.name}
            {version && ` · form v${version.version}`}
          </p>
        </div>
        <StageControls
          school={school}
          applicationId={application.id}
          stages={stages ?? []}
          currentStageId={application.stage_id}
          feeWaived={application.fee_waived}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Form responses</CardTitle>
            </CardHeader>
            <CardContent>
              {application.submitted_at === null && (
                <p className="mb-4 text-sm text-muted-foreground">
                  Draft — not yet submitted by the family.
                </p>
              )}
              {parsedSchema?.success ? (
                <ResponseFields fields={parsedSchema.data.fields} responses={application.responses} />
              ) : (
                <p className="text-sm text-muted-foreground">Form definition unavailable.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <DocumentReviewList
                school={school}
                documents={(documents ?? []).map((d) => ({
                  id: d.id,
                  name: d.document_requirements?.name ?? "Document",
                  required: d.document_requirements?.required ?? false,
                  status: d.status,
                  fileName: d.file_name,
                  rejectionReason: d.rejection_reason,
                  uploadedAt: d.uploaded_at,
                }))}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Internal notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <NoteForm school={school} applicationId={application.id} />
              <div className="space-y-3">
                {(notes ?? []).map((n) => (
                  <div key={n.id} className="rounded-md border p-3 text-sm">
                    <p className="whitespace-pre-wrap">{n.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {n.profiles?.full_name || n.profiles?.email || "Staff"} ·{" "}
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Audit trail</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {(audit ?? []).map((entry) => (
                  <li key={entry.id} className="text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{entry.action.replace(/_/g, " ")}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(entry.created_at).toLocaleString()}
                      </span>
                    </div>
                    {(entry.before || entry.after) != null && (
                      <p className="mt-1 font-mono text-xs text-muted-foreground">
                        {entry.before ? `${JSON.stringify(entry.before)} → ` : ""}
                        {entry.after ? JSON.stringify(entry.after) : ""}
                      </p>
                    )}
                  </li>
                ))}
                {(audit ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">No activity yet.</p>
                )}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
