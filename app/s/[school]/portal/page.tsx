import { requireMember } from "@/lib/tenant";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Family portal" };

export default async function PortalHomePage({
  params,
}: {
  params: Promise<{ school: string }>;
}) {
  const { school } = await params;
  const { tenant } = await requireMember(school);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Family portal</h1>
      <Card>
        <CardHeader>
          <CardTitle>Welcome</CardTitle>
          <CardDescription>
            Applications for {tenant.name} will appear here. Starting a new application takes
            about 15 minutes, and you can save a draft and come back anytime.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
