import "server-only";

import { createClient } from "@/lib/supabase/server";

/** Application rows joined with everything exports need. */
export interface ExportApplicationRow {
  id: string;
  grade_applying: string;
  submitted_at: string | null;
  payment_status: string;
  student: {
    id: string;
    first_name: string;
    last_name: string;
    date_of_birth: string | null;
    sis_id: string | null;
  };
  family: { id: string; name: string };
  stage: { key: string; label: string; category: string };
  period: { id: string; name: string; academic_year: string };
  guardians: { email: string; full_name: string | null }[];
}

export async function fetchApplicationsForExport(
  tenantId: string,
  periodId?: string
): Promise<ExportApplicationRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("applications")
    .select(
      `id, grade_applying, submitted_at, payment_status,
       students ( id, first_name, last_name, date_of_birth, sis_id ),
       families ( id, name ),
       pipeline_stages ( key, label, category ),
       enrollment_periods ( id, name, academic_year )`
    )
    .eq("tenant_id", tenantId);
  if (periodId) query = query.eq("period_id", periodId);

  const { data: applications } = await query.overrideTypes<
    {
      id: string;
      grade_applying: string;
      submitted_at: string | null;
      payment_status: string;
      students: ExportApplicationRow["student"] | null;
      families: ExportApplicationRow["family"] | null;
      pipeline_stages: ExportApplicationRow["stage"] | null;
      enrollment_periods: ExportApplicationRow["period"] | null;
    }[]
  >();

  const familyIds = Array.from(new Set((applications ?? []).map((a) => a.families?.id).filter(Boolean)));
  const guardiansByFamily = new Map<string, { email: string; full_name: string | null }[]>();
  if (familyIds.length > 0) {
    const { data: links } = await supabase
      .from("family_guardians")
      .select("family_id, profiles:user_id ( email, full_name )")
      .in("family_id", familyIds)
      .overrideTypes<
        { family_id: string; profiles: { email: string; full_name: string | null } | null }[]
      >();
    for (const link of links ?? []) {
      if (!link.profiles) continue;
      guardiansByFamily.set(link.family_id, [
        ...(guardiansByFamily.get(link.family_id) ?? []),
        link.profiles,
      ]);
    }
  }

  return (applications ?? [])
    .filter((a) => a.students && a.families && a.pipeline_stages && a.enrollment_periods)
    .map((a) => ({
      id: a.id,
      grade_applying: a.grade_applying,
      submitted_at: a.submitted_at,
      payment_status: a.payment_status,
      student: a.students!,
      family: a.families!,
      stage: a.pipeline_stages!,
      period: a.enrollment_periods!,
      guardians: guardiansByFamily.get(a.families!.id) ?? [],
    }));
}
