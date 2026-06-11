import { NextResponse, type NextRequest } from "next/server";

import { getStaffContext } from "@/lib/tenant";
import { toCsv } from "@/lib/integrations/csv";
import { fetchApplicationsForExport } from "@/lib/integrations/export-data";
import { EXPORT_FIELDS, type ExportFieldKey } from "@/lib/integrations/roster-fields";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ school: string }> }
) {
  const { school } = await params;
  const context = await getStaffContext(school);
  if (!context) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = request.nextUrl;
  const allowed = new Set(EXPORT_FIELDS.map((f) => f.key));
  const requested = (url.searchParams.get("fields") ?? "")
    .split(",")
    .filter((f): f is ExportFieldKey => allowed.has(f as ExportFieldKey));
  const fields: ExportFieldKey[] =
    requested.length > 0 ? requested : EXPORT_FIELDS.map((f) => f.key);
  const periodId = url.searchParams.get("periodId") ?? undefined;

  const rows = await fetchApplicationsForExport(context.tenant.id, periodId);
  const labelByKey = new Map(EXPORT_FIELDS.map((f) => [f.key, f.label]));

  const value = (row: (typeof rows)[number], field: ExportFieldKey): string => {
    switch (field) {
      case "student_first_name":
        return row.student.first_name;
      case "student_last_name":
        return row.student.last_name;
      case "student_dob":
        return row.student.date_of_birth ?? "";
      case "sis_id":
        return row.student.sis_id ?? "";
      case "grade_applying":
        return row.grade_applying;
      case "stage":
        return row.stage.label;
      case "period":
        return row.period.name;
      case "academic_year":
        return row.period.academic_year;
      case "family_name":
        return row.family.name;
      case "guardian_emails":
        return row.guardians.map((g) => g.email).join("; ");
      case "submitted_at":
        return row.submitted_at ?? "";
      case "payment_status":
        return row.payment_status;
    }
  };

  const csv = toCsv([
    fields.map((f) => labelByKey.get(f) ?? f),
    ...rows.map((row) => fields.map((f) => value(row, f))),
  ]);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="applications-${school}.csv"`,
    },
  });
}
