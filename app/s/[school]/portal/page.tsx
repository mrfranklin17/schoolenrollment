import Link from "next/link";

import { requireMember } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
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
}

const STAGE_BADGE: Record<string, "secondary" | "success" | "warning" | "destructive"> = {
  in_progress: "secondary",
  submitted: "warning",
  in_review: "warning",
  offered: "success",
  accepted: "success",
  enrolled: "success",
  waitlisted: "warning",
  declined: "destructive",
  withdrawn: "destructive",
};

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
        "id, grade_applying, submitted_at, students ( first_name, last_name ), pipeline_stages ( label, category ), enrollment_periods ( name )"
      )
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false })
      .overrideTypes<ApplicationRow[]>(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Family portal</h1>
        <Button asChild>
          <Link href={`/s/${school}/portal/apply`}>Start an application</Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Applications</CardTitle>
            <CardDescription>Track each child&apos;s application status here.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {(applications ?? []).length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              No applications yet. Add your students below, then start an application.
            </p>
          ) : (
            <div className="space-y-2">
              {(applications ?? []).map((a) => (
                <Link
                  key={a.id}
                  href={`/s/${school}/portal/applications/${a.id}`}
                  className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent"
                >
                  <div>
                    <p className="font-medium">
                      {a.students ? `${a.students.first_name} ${a.students.last_name}` : "Student"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Grade {a.grade_applying} · {a.enrollment_periods?.name}
                    </p>
                  </div>
                  <Badge
                    variant={
                      a.pipeline_stages
                        ? (STAGE_BADGE[a.pipeline_stages.category] ?? "secondary")
                        : "secondary"
                    }
                  >
                    {a.pipeline_stages?.label ?? "Draft"}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
                <li key={s.id} className="flex items-center justify-between rounded-lg border p-3">
                  <span className="font-medium">
                    {s.first_name} {s.last_name}
                  </span>
                  {s.current_grade && (
                    <span className="text-sm text-muted-foreground">
                      Current grade: {s.current_grade}
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
