import { notFound } from "next/navigation";

import { requireMember } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { formSchemaSchema, type FormResponses } from "@/lib/forms/schema";
import { Badge } from "@/components/ui/badge";
import { ApplicationEditor } from "./application-editor";

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
  await requireMember(school);
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
