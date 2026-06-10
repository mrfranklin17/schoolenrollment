import { requireStaff } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NewLotteryForm, OfferNextButton, RunLotteryButton } from "./lottery-widgets";

export const metadata = { title: "Lottery & waitlist" };

interface LotteryRow {
  id: string;
  grade: string | null;
  seed: string;
  status: string;
  run_at: string | null;
  results: { seats?: number; entries?: number; offered?: number; waitlisted?: number } | null;
  period_id: string;
  enrollment_periods: { name: string } | null;
}

interface WaitlistRow {
  id: string;
  rank: number;
  grade: string;
  period_id: string;
  applications: {
    id: string;
    grade_applying: string;
    students: { first_name: string; last_name: string } | null;
  } | null;
}

export default async function LotteryPage({ params }: { params: Promise<{ school: string }> }) {
  const { school } = await params;
  const { tenant } = await requireStaff(school);
  const supabase = await createClient();

  const [{ data: lotteries }, { data: periods }, { data: waitlist }] = await Promise.all([
    supabase
      .from("lotteries")
      .select("id, grade, seed, status, run_at, results, period_id, enrollment_periods ( name )")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false })
      .overrideTypes<LotteryRow[]>(),
    supabase
      .from("enrollment_periods")
      .select("id, name")
      .eq("tenant_id", tenant.id)
      .eq("is_active", true)
      .overrideTypes<{ id: string; name: string }[]>(),
    supabase
      .from("waitlist_positions")
      .select(
        "id, rank, grade, period_id, applications ( id, grade_applying, students ( first_name, last_name ) )"
      )
      .eq("tenant_id", tenant.id)
      .order("rank")
      .overrideTypes<WaitlistRow[]>(),
  ]);

  const waitlistGroups = new Map<string, WaitlistRow[]>();
  for (const w of waitlist ?? []) {
    const key = `${w.period_id}:${w.grade}`;
    waitlistGroups.set(key, [...(waitlistGroups.get(key) ?? []), w]);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Lottery &amp; waitlist</h1>
        <p className="text-muted-foreground">
          Deterministic, seeded draws — rerunning a lottery with the same seed always produces
          the same result, so every outcome is auditable.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New lottery</CardTitle>
          <CardDescription>
            Weighted preferences apply when the application form has fields keyed{" "}
            <code className="font-mono text-xs">sibling</code>,{" "}
            <code className="font-mono text-xs">staff_child</code>, or{" "}
            <code className="font-mono text-xs">zone</code> answered yes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewLotteryForm school={school} periods={periods ?? []} />
        </CardContent>
      </Card>

      <div className="space-y-3">
        {(lotteries ?? []).map((l) => (
          <Card key={l.id}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">
                  {l.enrollment_periods?.name} — Grade {l.grade ?? "all"}
                </CardTitle>
                <CardDescription className="font-mono text-xs">seed: {l.seed}</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={l.status === "run" ? "success" : "secondary"}>{l.status}</Badge>
                <RunLotteryButton school={school} lotteryId={l.id} hasRun={l.status !== "draft"} />
              </div>
            </CardHeader>
            {l.results && (
              <CardContent className="text-sm text-muted-foreground">
                {l.results.entries} entries · {l.results.offered} offered · {l.results.waitlisted}{" "}
                waitlisted · {l.results.seats} seats
                {l.run_at && ` · run ${new Date(l.run_at).toLocaleString()}`}
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Waitlists</CardTitle>
          <CardDescription>
            When a family declines or an offer expires, offer the next seat with one click.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {waitlistGroups.size === 0 && (
            <p className="text-sm text-muted-foreground">No one is waitlisted right now.</p>
          )}
          {Array.from(waitlistGroups.entries()).map(([key, rows]) => {
            const [periodId, grade] = key.split(":");
            return (
              <div key={key}>
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-medium">Grade {grade}</p>
                  <OfferNextButton school={school} periodId={periodId} grade={grade} />
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">#</TableHead>
                      <TableHead>Student</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((w) => (
                      <TableRow key={w.id}>
                        <TableCell>{w.rank}</TableCell>
                        <TableCell>
                          {w.applications?.students
                            ? `${w.applications.students.first_name} ${w.applications.students.last_name}`
                            : "Student"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
