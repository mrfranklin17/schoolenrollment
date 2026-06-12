import { requireStaff } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { PipelineView, type PipelineApplication } from "./pipeline-view";

export const metadata = { title: "Pipeline" };

interface AppRow {
  id: string;
  grade_applying: string;
  submitted_at: string | null;
  payment_status: string;
  fee_waived: boolean;
  created_at: string;
  stage_id: string;
  students: { first_name: string; last_name: string } | null;
  enrollment_periods: { name: string } | null;
  application_documents: { status: string }[];
}

export default async function AdminPipelinePage({
  params,
}: {
  params: Promise<{ school: string }>;
}) {
  const { school } = await params;
  const { tenant } = await requireStaff(school);
  const supabase = await createClient();

  const [{ data: stages }, { data: applications }, { data: capacities }] = await Promise.all([
    supabase
      .from("pipeline_stages")
      .select("id, key, label, category, position")
      .eq("tenant_id", tenant.id)
      .order("position")
      .overrideTypes<{ id: string; key: string; label: string; category: string; position: number }[]>(),
    supabase
      .from("applications")
      .select(
        "id, grade_applying, submitted_at, payment_status, fee_waived, created_at, stage_id, students ( first_name, last_name ), enrollment_periods ( name ), application_documents ( status )"
      )
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false })
      .overrideTypes<AppRow[]>(),
    supabase
      .from("grade_capacities")
      .select("grade, seats")
      .eq("tenant_id", tenant.id)
      .overrideTypes<{ grade: string; seats: number }[]>(),
  ]);

  const rows: PipelineApplication[] = (applications ?? []).map((a) => ({
    id: a.id,
    studentName: a.students ? `${a.students.first_name} ${a.students.last_name}` : "Student",
    grade: a.grade_applying,
    period: a.enrollment_periods?.name ?? "",
    stageId: a.stage_id,
    submittedAt: a.submitted_at,
    paymentStatus: a.payment_status,
    feeWaived: a.fee_waived,
    docsVerified: a.application_documents.filter((d) => d.status === "verified").length,
    docsTotal: a.application_documents.length,
  }));

  // Capacity tracking: enrolled/accepted count vs seats per grade.
  const acceptedCategories = new Set(["accepted", "enrolled"]);
  const acceptedStageIds = new Set(
    (stages ?? []).filter((s) => acceptedCategories.has(s.category)).map((s) => s.id)
  );
  const capacity = (capacities ?? []).map((c) => ({
    grade: c.grade,
    seats: c.seats,
    filled: rows.filter((r) => r.grade === c.grade && acceptedStageIds.has(r.stageId)).length,
  }));

  const stageById = new Map((stages ?? []).map((s) => [s.id, s]));
  const countByCategory = (categories: string[]) =>
    rows.filter((r) => categories.includes(stageById.get(r.stageId)?.category ?? "")).length;

  const stats = [
    { label: "Applications", value: rows.length },
    { label: "Submitted", value: rows.filter((r) => r.submittedAt).length },
    { label: "Offers out", value: countByCategory(["offered"]) },
    { label: "Accepted + enrolled", value: countByCategory(["accepted", "enrolled"]) },
    { label: "Waitlisted", value: countByCategory(["waitlisted"]) },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border bg-card px-4 py-3 shadow-sm">
            <p className="text-2xl font-extrabold text-foreground">{stat.value}</p>
            <p className="text-xs font-semibold text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>
      <PipelineView school={school} stages={stages ?? []} applications={rows} capacity={capacity} />
    </div>
  );
}
