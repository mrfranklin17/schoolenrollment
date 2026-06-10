import { notFound } from "next/navigation";

import { requireStaff } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { formSchemaSchema, type FormSchema } from "@/lib/forms/schema";
import { FormBuilder } from "@/components/form-builder/form-builder";

export const metadata = { title: "Edit form" };

interface VersionRow {
  id: string;
  version: number;
  schema: unknown;
  published_at: string | null;
}

export default async function FormEditorPage({
  params,
}: {
  params: Promise<{ school: string; templateId: string }>;
}) {
  const { school, templateId } = await params;
  const { tenant } = await requireStaff(school);
  const supabase = await createClient();

  const { data: template } = await supabase
    .from("form_templates")
    .select("id, name")
    .eq("id", templateId)
    .eq("tenant_id", tenant.id)
    .maybeSingle<{ id: string; name: string }>();

  if (!template) notFound();

  const { data: versions } = await supabase
    .from("form_versions")
    .select("id, version, schema, published_at")
    .eq("template_id", templateId)
    .order("version", { ascending: false })
    .overrideTypes<VersionRow[]>();

  const latest = versions?.[0];
  const publishedVersion =
    versions?.find((v) => v.published_at !== null)?.version ?? null;

  const parsed = latest ? formSchemaSchema.safeParse(latest.schema) : null;
  const initialSchema: FormSchema = parsed?.success
    ? parsed.data
    : { title: template.name, description: "", fields: [] };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{template.name}</h1>
        <p className="text-muted-foreground">
          Add fields, set conditional logic, then publish when ready.
        </p>
      </div>
      <FormBuilder
        school={school}
        templateId={templateId}
        initialSchema={initialSchema}
        isDraft={latest ? latest.published_at === null : false}
        publishedVersion={publishedVersion}
      />
    </div>
  );
}
