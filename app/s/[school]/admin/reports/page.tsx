import { requireStaff } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Reports" };

export default async function ReportsPage({ params }: { params: Promise<{ school: string }> }) {
  const { school } = await params;
  const { tenant } = await requireStaff(school);
  const supabase = await createClient();

  const [{ data: stages }, { data: applications }, { count: emailCount }] = await Promise.all([
    supabase
      .from("pipeline_stages")
      .select("id, label, position")
      .eq("tenant_id", tenant.id)
      .order("position")
      .overrideTypes<{ id: string; label: string; position: number }[]>(),
    supabase
      .from("applications")
      .select("id, stage_id, submitted_at, created_at")
      .eq("tenant_id", tenant.id)
      .overrideTypes<
        { id: string; stage_id: string; submitted_at: string | null; created_at: string }[]
      >(),
    supabase
      .from("email_log")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id),
  ]);

  const total = (applications ?? []).length;
  const submitted = (applications ?? []).filter((a) => a.submitted_at).length;
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recent = (applications ?? []).filter(
    (a) => Date.parse(a.created_at) >= thirtyDaysAgo
  ).length;

  const byStage = (stages ?? []).map((s) => {
    const count = (applications ?? []).filter((a) => a.stage_id === s.id).length;
    return {
      label: s.label,
      count,
      share: total > 0 ? Math.round((count / total) * 100) : 0,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-muted-foreground">A quick read on this enrollment cycle.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total applications", value: total },
          { label: "Submitted", value: submitted },
          { label: "Started in last 30 days", value: recent },
          { label: "Emails sent", value: emailCount ?? 0 },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="text-3xl">{stat.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Conversion by stage</CardTitle>
          <CardDescription>Where applicants currently sit in your pipeline.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Stage</TableHead>
                <TableHead className="w-28">Applications</TableHead>
                <TableHead>Share</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byStage.map((row) => (
                <TableRow key={row.label}>
                  <TableCell>{row.label}</TableCell>
                  <TableCell>{row.count}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-full max-w-48 overflow-hidden rounded bg-muted">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${row.share}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">{row.share}%</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
