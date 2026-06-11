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
import { ExportPanel, RosterImporter } from "./data-widgets";

export const metadata = { title: "Import / Export" };

export default async function DataPage({ params }: { params: Promise<{ school: string }> }) {
  const { school } = await params;
  const { tenant } = await requireStaff(school);
  const supabase = await createClient();

  const [{ data: jobs }, { data: periods }] = await Promise.all([
    supabase
      .from("import_jobs")
      .select("id, file_name, status, stats, created_at")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false })
      .limit(20)
      .overrideTypes<
        {
          id: string;
          file_name: string | null;
          status: string;
          stats: { created?: number; updated?: number; skipped?: number } | null;
          created_at: string;
        }[]
      >(),
    supabase
      .from("enrollment_periods")
      .select("id, name")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false })
      .overrideTypes<{ id: string; name: string }[]>(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Import / Export</h1>
        <p className="text-muted-foreground">
          Bring in returning-student rosters and push enrollment data to your SIS.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Import a returning-student roster</CardTitle>
          <CardDescription>
            Upload a CSV from your SIS, map the columns, and we&apos;ll create families and
            students. Guardians who sign up with a matching email are automatically linked to
            their imported family for re-enrollment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RosterImporter school={school} />
        </CardContent>
      </Card>

      {(jobs ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Import history</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(jobs ?? []).map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>{job.file_name}</TableCell>
                    <TableCell>
                      <Badge variant={job.status === "completed" ? "success" : "secondary"}>
                        {job.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {job.stats
                        ? `${job.stats.created ?? 0} created · ${job.stats.updated ?? 0} updated · ${job.stats.skipped ?? 0} skipped`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(job.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Export</CardTitle>
          <CardDescription>
            Flat CSV with your choice of columns (PowerSchool, FACTS, Blackbaud, spreadsheets) or
            a OneRoster 1.2 CSV bundle of accepted &amp; enrolled students.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ExportPanel school={school} periods={periods ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
