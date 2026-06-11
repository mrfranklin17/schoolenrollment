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
import { BrandingForm, CapacityForm, NewPeriodForm, NewRequirementForm } from "./settings-forms";

export const metadata = { title: "Settings" };

interface PeriodRow {
  id: string;
  name: string;
  academic_year: string;
  opens_at: string | null;
  closes_at: string | null;
  is_active: boolean;
}

interface CapacityRow {
  id: string;
  period_id: string;
  grade: string;
  seats: number;
}

interface RequirementRow {
  id: string;
  name: string;
  description: string | null;
  required: boolean;
  period_id: string | null;
}

export default async function SettingsPage({ params }: { params: Promise<{ school: string }> }) {
  const { school } = await params;
  const { tenant } = await requireStaff(school);
  const supabase = await createClient();

  const [{ data: periods }, { data: capacities }, { data: requirements }] = await Promise.all([
    supabase
      .from("enrollment_periods")
      .select("id, name, academic_year, opens_at, closes_at, is_active")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false })
      .overrideTypes<PeriodRow[]>(),
    supabase
      .from("grade_capacities")
      .select("id, period_id, grade, seats")
      .eq("tenant_id", tenant.id)
      .overrideTypes<CapacityRow[]>(),
    supabase
      .from("document_requirements")
      .select("id, name, description, required, period_id")
      .eq("tenant_id", tenant.id)
      .order("position")
      .overrideTypes<RequirementRow[]>(),
  ]);

  const { data: tenantRow } = await supabase
    .from("tenants")
    .select("name, logo_url, primary_color, trial_ends_at, subscription_status")
    .eq("id", tenant.id)
    .maybeSingle<{
      name: string;
      logo_url: string | null;
      primary_color: string | null;
      trial_ends_at: string;
      subscription_status: string;
    }>();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Branding</CardTitle>
          <CardDescription>
            Shown on your school landing page and family portal. Subscription:{" "}
            <Badge variant="secondary">{tenantRow?.subscription_status ?? "trialing"}</Badge>
            {tenantRow?.subscription_status === "trialing" && tenantRow.trial_ends_at && (
              <> · trial ends {new Date(tenantRow.trial_ends_at).toLocaleDateString()}</>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BrandingForm
            school={school}
            initial={{
              name: tenantRow?.name ?? tenant.name,
              logoUrl: tenantRow?.logo_url ?? "",
              primaryColor: tenantRow?.primary_color ?? "",
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Enrollment periods</CardTitle>
          <CardDescription>
            Families can apply while a period is open. Capacities power waitlists and the
            lottery.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {(periods ?? []).map((p) => {
            const caps = (capacities ?? []).filter((c) => c.period_id === p.id);
            return (
              <div key={p.id} className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {p.name} <span className="text-muted-foreground">({p.academic_year})</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {p.opens_at ? new Date(p.opens_at).toLocaleDateString() : "Always open"} –{" "}
                      {p.closes_at ? new Date(p.closes_at).toLocaleDateString() : "no close date"}
                    </p>
                  </div>
                  <Badge variant={p.is_active ? "success" : "secondary"}>
                    {p.is_active ? "active" : "inactive"}
                  </Badge>
                </div>
                {caps.length > 0 && (
                  <Table className="mt-3">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Grade</TableHead>
                        <TableHead>Seats</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {caps.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell>{c.grade}</TableCell>
                          <TableCell>{c.seats}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                <div className="mt-3">
                  <CapacityForm school={school} periodId={p.id} />
                </div>
              </div>
            );
          })}
          <NewPeriodForm school={school} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Document checklist</CardTitle>
          <CardDescription>
            Documents families must upload (birth certificate, proof of residency, …). Applied
            to every application when it&apos;s submitted.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(requirements ?? []).length > 0 && (
            <ul className="space-y-2">
              {(requirements ?? []).map((r) => (
                <li key={r.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium">{r.name}</p>
                    {r.description && (
                      <p className="text-sm text-muted-foreground">{r.description}</p>
                    )}
                  </div>
                  <Badge variant={r.required ? "default" : "secondary"}>
                    {r.required ? "required" : "optional"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
          <NewRequirementForm school={school} />
        </CardContent>
      </Card>
    </div>
  );
}
