import { notFound } from "next/navigation";

import { requireMember } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { formSchemaSchema, type FormResponses } from "@/lib/forms/schema";
import { Badge } from "@/components/ui/badge";
import { DocumentChecklist, type ChecklistDocument } from "@/components/documents/document-checklist";
import { Separator } from "@/components/ui/separator";
import { ApplicationEditor } from "./application-editor";
import { OfferBanner } from "./offer-banner";

export const metadata = { title: "Application" };

interface ApplicationRow {
  id: string;
  responses: FormResponses;
  submitted_at: string | null;
  grade_applying: string;
  form_version_id: string;
  students: { first_name: string; last_name: string } | null;
  pipeline_stages: { label: string } | null;
  enrollment_periods: { name: string } | null;
}

export default async function ApplicationPage({
  params,
}: {
  params: Promise<{ school: string; id: string }>;
}) {
  const { school, id } = await params;
  const { tenant } = await requireMember(school);
  const supabase = await createClient();

  const { data: application } = await supabase
    .from("applications")
    .select(
      "id, responses, submitted_at, grade_applying, form_version_id, students ( first_name, last_name ), pipeline_stages ( label ), enrollment_periods ( name )"
    )
    .eq("id", id)
    .maybeSingle<ApplicationRow>();

  if (!application) notFound();

  const { data: version } = await supabase
    .from("form_versions")
    .select("schema")
    .eq("id", application.form_version_id)
    .maybeSingle<{ schema: unknown }>();

  const parsed = version ? formSchemaSchema.safeParse(version.schema) : null;
  if (!parsed?.success) notFound();

  const { data: pendingOffer } = await supabase
    .from("offers")
    .select("id, expires_at")
    .eq("application_id", id)
    .eq("status", "pending")
    .order("extended_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; expires_at: string | null }>();

  let checklist: ChecklistDocument[] = [];
  if (application.submitted_at) {
    const { data: documents } = await supabase
      .from("application_documents")
      .select(
        "id, status, file_name, rejection_reason, document_requirements ( name, description, required )"
      )
      .eq("application_id", id)
      .overrideTypes<
        {
          id: string;
          status: string;
          file_name: string | null;
          rejection_reason: string | null;
          document_requirements: { name: string; description: string | null; required: boolean } | null;
        }[]
      >();
    checklist = (documents ?? []).map((d) => ({
      id: d.id,
      name: d.document_requirements?.name ?? "Document",
      description: d.document_requirements?.description ?? null,
      required: d.document_requirements?.required ?? false,
      status: d.status,
      fileName: d.file_name,
      rejectionReason: d.rejection_reason,
    }));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{parsed.data.title}</h1>
          <p className="text-muted-foreground">
            {application.students
              ? `${application.students.first_name} ${application.students.last_name}`
              : "Student"}{" "}
            · Grade {application.grade_applying} · {application.enrollment_periods?.name}
          </p>
        </div>
        <Badge variant={application.submitted_at ? "success" : "secondary"}>
          {application.pipeline_stages?.label ?? "Draft"}
        </Badge>
      </div>
      {parsed.data.description && (
        <p className="text-sm text-muted-foreground">{parsed.data.description}</p>
      )}
      {pendingOffer && (!pendingOffer.expires_at || Date.parse(pendingOffer.expires_at) > Date.now()) && (
        <OfferBanner school={school} offerId={pendingOffer.id} expiresAt={pendingOffer.expires_at} />
      )}
      {application.submitted_at && checklist.length > 0 && (
        <>
          <DocumentChecklist
            school={school}
            tenantId={tenant.id}
            applicationId={application.id}
            documents={checklist}
          />
          <Separator />
        </>
      )}
      <ApplicationEditor
        school={school}
        applicationId={application.id}
        schema={parsed.data}
        initialResponses={application.responses ?? {}}
        submitted={application.submitted_at !== null}
      />
    </div>
  );
}
