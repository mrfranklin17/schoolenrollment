import Link from "next/link";

import { requireUser } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { MembershipRole } from "@/lib/types";

export const metadata = { title: "Your schools" };

interface MembershipRow {
  role: MembershipRole;
  tenants: { id: string; slug: string; name: string } | null;
}

export default async function SchoolsPage() {
  await requireUser("/schools");
  const supabase = await createClient();

  const { data } = await supabase
    .from("memberships")
    .select("role, tenants ( id, slug, name )")
    .overrideTypes<MembershipRow[]>();

  const memberships = (data ?? []).filter((m) => m.tenants);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your schools</h1>
        <Button variant="outline" asChild>
          <Link href="/onboarding">Add a school</Link>
        </Button>
      </div>
      {memberships.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No schools yet</CardTitle>
            <CardDescription>
              Running admissions for a school? Start a free trial. Applying as a parent? Use the
              application link your school shared with you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/onboarding">Start a school</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {memberships.map((m) => {
            const t = m.tenants!;
            const isStaff = m.role === "school_admin" || m.role === "staff";
            return (
              <Link
                key={t.id}
                href={isStaff ? `/s/${t.slug}/admin` : `/s/${t.slug}/portal`}
                className="block"
              >
                <Card className="transition-colors hover:bg-accent">
                  <CardHeader className="flex-row items-center justify-between space-y-0">
                    <CardTitle>{t.name}</CardTitle>
                    <Badge variant="secondary">{m.role.replace("_", " ")}</Badge>
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
