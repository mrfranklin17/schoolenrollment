import { requireMember } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApplyForm } from "./apply-form";

export const metadata = { title: "Start an application" };

export default async function ApplyPage({ params }: { params: Promise<{ school: string }> }) {
  const { school } = await params;
  const { tenant } = await requireMember(school);
  const supabase = await createClient();

  // Make sure first-time visitors get a guardian membership + family.
  await supabase.rpc("ensure_guardian_family", { p_tenant_id: tenant.id, p_family_name: null });

  const [{ data: students }, { data: periods }] = await Promise.all([
    supabase
      .from("students")
      .select("id, first_name, last_name")
      .eq("tenant_id", tenant.id)
      .order("created_at")
      .overrideTypes<{ id: string; first_name: string; last_name: string }[]>(),
    supabase
      .from("enrollment_periods")
      .select("id, name, academic_year, opens_at, closes_at")
      .eq("tenant_id", tenant.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .overrideTypes<
        { id: string; name: string; academic_year: string; opens_at: string | null; closes_at: string | null }[]
      >(),
  ]);

  const now = Date.now();
  const openPeriods = (periods ?? []).filter(
    (p) =>
      (!p.opens_at || Date.parse(p.opens_at) <= now) &&
      (!p.closes_at || Date.parse(p.closes_at) >= now)
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Start an application</h1>
      {openPeriods.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Applications are closed</CardTitle>
            <CardDescription>
              {tenant.name} doesn&apos;t have an open enrollment window right now. Check back
              later or contact the school.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Who are you applying for?</CardTitle>
            <CardDescription>
              Pick the student, school year, and the grade they&apos;re applying to enter.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ApplyForm school={school} students={students ?? []} periods={openPeriods} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
