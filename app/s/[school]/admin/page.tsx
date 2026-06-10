import { requireStaff } from "@/lib/tenant";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Admin" };

export default async function AdminDashboardPage({
  params,
}: {
  params: Promise<{ school: string }>;
}) {
  const { school } = await params;
  const { tenant } = await requireStaff(school);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Welcome to {tenant.name}</h1>
        <p className="text-muted-foreground">
          Your enrollment pipeline will appear here once applications start coming in.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Getting started</CardTitle>
          <CardDescription>
            Next up: build your application form, set your enrollment period and grade
            capacities, then share your application link with families.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Application link:{" "}
          <span className="font-mono text-foreground">/s/{tenant.slug}</span>
        </CardContent>
      </Card>
    </div>
  );
}
