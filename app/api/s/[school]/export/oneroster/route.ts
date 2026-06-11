import { NextResponse, type NextRequest } from "next/server";

import { getStaffContext } from "@/lib/tenant";
import { fetchApplicationsForExport } from "@/lib/integrations/export-data";
import { buildOneRosterZip } from "@/lib/integrations/oneroster";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ school: string }> }
) {
  const { school } = await params;
  const context = await getStaffContext(school);
  if (!context) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const periodId = request.nextUrl.searchParams.get("periodId") ?? undefined;
  const rows = await fetchApplicationsForExport(context.tenant.id, periodId);
  const zip = await buildOneRosterZip(
    { id: context.tenant.id, name: context.tenant.name, slug: context.tenant.slug },
    rows
  );

  return new NextResponse(Buffer.from(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="oneroster-${school}.zip"`,
    },
  });
}
