import Link from "next/link";

import { requireStaff } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NewFormDialog } from "./new-form-dialog";

export const metadata = { title: "Forms" };

interface TemplateRow {
  id: string;
  name: string;
  grade_levels: string[] | null;
  enrollment_periods: { name: string } | null;
  form_versions: { version: number; published_at: string | null }[];
}

export default async function FormsPage({ params }: { params: Promise<{ school: string }> }) {
  const { school } = await params;
  const { tenant } = await requireStaff(school);
  const supabase = await createClient();

  const [{ data: templates }, { data: periods }] = await Promise.all([
    supabase
      .from("form_templates")
      .select("id, name, grade_levels, enrollment_periods ( name ), form_versions ( version, published_at )")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false })
      .overrideTypes<TemplateRow[]>(),
    supabase
      .from("enrollment_periods")
      .select("id, name")
      .eq("tenant_id", tenant.id)
      .eq("is_active", true)
      .overrideTypes<{ id: string; name: string }[]>(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Application forms</h1>
          <p className="text-muted-foreground">
            Build the forms families fill out. Published versions are frozen — submitted
            applications always keep the exact version they used.
          </p>
        </div>
        <NewFormDialog school={school} periods={periods ?? []} />
      </div>

      {(templates ?? []).length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No forms yet</CardTitle>
            <CardDescription>Create your first application form to get started.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-3">
          {(templates ?? []).map((t) => {
            const published = t.form_versions
              .filter((v) => v.published_at)
              .sort((a, b) => b.version - a.version)[0];
            const hasDraft = t.form_versions.some((v) => !v.published_at);
            return (
              <Link key={t.id} href={`/s/${school}/admin/forms/${t.id}`} className="block">
                <Card className="transition-colors hover:bg-accent">
                  <CardHeader className="flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle>{t.name}</CardTitle>
                      <CardDescription>
                        {t.enrollment_periods?.name ?? "No period"} ·{" "}
                        {t.grade_levels?.length ? `Grades ${t.grade_levels.join(", ")}` : "All grades"}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {published ? (
                        <Badge variant="success">v{published.version} live</Badge>
                      ) : (
                        <Badge variant="secondary">unpublished</Badge>
                      )}
                      {hasDraft && <Badge variant="outline">draft</Badge>}
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
