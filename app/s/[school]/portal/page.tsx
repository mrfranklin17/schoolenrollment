import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";

import { requireMember } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { stageChipClass } from "@/lib/stage-style";
import { cn } from "@/lib/utils";
import { JourneyStepper } from "@/components/portal/journey-stepper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AddStudentDialog } from "./add-student-dialog";

export const metadata = { title: "Family portal" };

interface StudentRow {
  id: string;
  first_name: string;
  last_name: string;
  current_grade: string | null;
}

interface ApplicationRow {
  id: string;
  grade_applying: string;
  submitted_at: string | null;
  students: { first_name: string; last_name: string } | null;
  pipeline_stages: { label: string; category: string } | null;
  enrollment_periods: { name: string } | null;
  application_documents: { status: string }[];
}

export default async function PortalHomePage({
  params,
}: {
  params: Promise<{ school: string }>;
}) {
  const { school } = await params;
  const { tenant } = await requireMember(school);
  const supabase = await createClient();

  const [{ data: students }, { data: applications }] = await Promise.all([
    supabase
      .from("students")
      .select("id, first_name, last_name, current_grade")
      .eq("tenant_id", tenant.id)
      .order("created_at")
      .overrideTypes<StudentRow[]>(),
    supabase
      .from("applications")
      .select(
        "id, grade_applying, submitted_at, students ( first_name, last_name ), pipeline_stages ( label, category ), enrollment_periods ( name ), application_documents ( status )"
      )
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false })
      .overrideTypes<ApplicationRow[]>(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Welcome back!</h1>
          <p className="text-sm text-muted-foreground">
            Track applications and upload documents — all in one place.
          </p>
        </div>
        <Button asChild className="shrink-0">
          <Link href={`/s/${school}/portal/apply`}>
            <Plus /> New application
          </Link>
        </Button>
      </div>

      {(applications ?? []).length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Start your first application</CardTitle>
            <CardDescription>
              Add your students below, then start an application — it takes about 15 minutes
              and you can save a draft anytime.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-3">
          {(applications ?? []).map((a) => {
            const docsNeeded = a.application_documents.filter(
              (d) => d.status === "missing" || d.status === "rejected"
            ).length;
            return (
              <Link key={a.id} href={`/s/${school}/portal/applications/${a.id}`} className="block">
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="space-y-4 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-extrabold leading-tight">
                          {a.students
                            ? `${a.students.first_name} ${a.students.last_name}`
                            : "Student"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {a.grade_applying === "K"
                            ? "Kindergarten"
                            : a.grade_applying === "PK"
                              ? "Pre-K"
                              : `Grade ${a.grade_applying}`}{" "}
                          · {a.enrollment_periods?.name}
                        </p>
                      </div>
                      <span className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-3 py-1 text-xs font-bold",
                            stageChipClass(a.pipeline_stages?.category)
                          )}
                        >
                          {a.pipeline_stages?.label ?? "Draft"}
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </span>
                    </div>
                    <JourneyStepper category={a.pipeline_stages?.category} />
                    {docsNeeded > 0 && (
                      <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                        {docsNeeded} document{docsNeeded === 1 ? "" : "s"} still needed — tap to
                        upload
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Your students</CardTitle>
            <CardDescription>Add each child you plan to enroll.</CardDescription>
          </div>
          <AddStudentDialog school={school} />
        </CardHeader>
        <CardContent>
          {(students ?? []).length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No students added yet.</p>
          ) : (
            <ul className="space-y-2">
              {(students ?? []).map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--brand)]/15 text-sm font-extrabold text-[color:var(--brand)]">
                    {s.first_name[0]}
                    {s.last_name[0]}
                  </span>
                  <span className="font-bold">
                    {s.first_name} {s.last_name}
                  </span>
                  {s.current_grade && (
                    <span className="ml-auto text-sm text-muted-foreground">
                      Grade {s.current_grade}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
