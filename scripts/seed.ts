/**
 * Seed a demo school with a published form, families, applicants in every
 * pipeline stage, and a ready-to-run lottery.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/seed.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 * Demo logins (password: demo1234!):
 *   admin@demo.enrollly.test, parent1@demo.enrollly.test … parent6
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const db = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PASSWORD = "demo1234!";
const SLUG = "demo-academy";

async function ensureUser(email: string, fullName: string): Promise<string> {
  const { data: created, error } = await db.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (created?.user) return created.user.id;
  if (error && !/already/i.test(error.message)) throw error;
  // Already exists — look it up.
  const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
  const existing = data?.users.find((u) => u.email === email);
  if (!existing) throw new Error(`could not create or find ${email}`);
  return existing.id;
}

async function main() {
  console.log("Seeding demo school…");

  // Clean up a previous run.
  const { data: prior } = await db.from("tenants").select("id").eq("slug", SLUG).maybeSingle();
  if (prior) {
    await db.from("tenants").delete().eq("id", prior.id);
    console.log("Removed previous demo tenant");
  }

  const adminId = await ensureUser("admin@demo.enrollly.test", "Dana Director");
  const parentIds: string[] = [];
  const parentNames = [
    "Priya Patel",
    "Marcus Lee",
    "Sofia Alvarez",
    "Jordan Kim",
    "Amara Johnson",
    "Theo Novak",
  ];
  for (let i = 0; i < parentNames.length; i++) {
    parentIds.push(await ensureUser(`parent${i + 1}@demo.enrollly.test`, parentNames[i]));
  }

  const { data: tenant, error: tenantError } = await db
    .from("tenants")
    .insert({ slug: SLUG, name: "Demo Academy", primary_color: "#1d4ed8" })
    .select("id")
    .single();
  if (tenantError || !tenant) throw tenantError ?? new Error("tenant insert failed");
  const tenantId = tenant.id as string;

  const stageDefs = [
    ["started", "Started", "in_progress"],
    ["submitted", "Submitted", "submitted"],
    ["under_review", "Under Review", "in_review"],
    ["offered", "Offered", "offered"],
    ["accepted", "Accepted", "accepted"],
    ["enrolled", "Enrolled", "enrolled"],
    ["waitlisted", "Waitlisted", "waitlisted"],
    ["declined", "Declined", "declined"],
  ] as const;
  const { data: stages } = await db
    .from("pipeline_stages")
    .insert(
      stageDefs.map(([key, label, category], i) => ({
        tenant_id: tenantId,
        key,
        label,
        category,
        position: i,
      }))
    )
    .select("id, key");
  const stageId = (key: string) => stages!.find((s) => s.key === key)!.id as string;

  await db.from("memberships").insert([
    { tenant_id: tenantId, user_id: adminId, role: "school_admin" },
    ...parentIds.map((id) => ({ tenant_id: tenantId, user_id: id, role: "guardian" as const })),
  ]);

  const { data: period } = await db
    .from("enrollment_periods")
    .insert({
      tenant_id: tenantId,
      academic_year: "2026-2027",
      name: "Fall 2026 Open Enrollment",
      opens_at: new Date(Date.now() - 30 * 86400_000).toISOString(),
      closes_at: new Date(Date.now() + 60 * 86400_000).toISOString(),
    })
    .select("id")
    .single();
  const periodId = period!.id as string;

  await db.from("grade_capacities").insert([
    { tenant_id: tenantId, period_id: periodId, grade: "K", seats: 2 },
    { tenant_id: tenantId, period_id: periodId, grade: "1", seats: 20 },
    { tenant_id: tenantId, period_id: periodId, grade: "6", seats: 15 },
  ]);

  const { data: requirements } = await db
    .from("document_requirements")
    .insert([
      {
        tenant_id: tenantId,
        period_id: periodId,
        name: "Birth certificate",
        description: "A photo or scan is fine",
        required: true,
        position: 0,
      },
      {
        tenant_id: tenantId,
        period_id: periodId,
        name: "Proof of residency",
        description: "Utility bill or lease",
        required: true,
        position: 1,
      },
      {
        tenant_id: tenantId,
        period_id: periodId,
        name: "IEP / 504 plan",
        description: "If applicable",
        required: false,
        position: 2,
      },
    ])
    .select("id");

  const { data: template } = await db
    .from("form_templates")
    .insert({ tenant_id: tenantId, period_id: periodId, name: "2026–27 New Student Application" })
    .select("id")
    .single();
  const { data: formVersion } = await db
    .from("form_versions")
    .insert({
      tenant_id: tenantId,
      template_id: template!.id,
      version: 1,
      published_at: new Date().toISOString(),
      schema: {
        title: "2026–27 New Student Application",
        description: "Welcome to Demo Academy! This takes about 10 minutes.",
        fields: [
          { key: "about", type: "section", label: "About your student", required: false },
          { key: "previous_school", type: "text", label: "Previous school (if any)", required: false },
          {
            key: "shirt_size",
            type: "select",
            label: "Uniform shirt size",
            required: true,
            options: [
              { value: "xs", label: "XS" },
              { value: "s", label: "S" },
              { value: "m", label: "M" },
              { value: "l", label: "L" },
            ],
          },
          { key: "sibling", type: "checkbox", label: "A sibling already attends Demo Academy", required: false },
          { key: "staff_child", type: "checkbox", label: "A parent/guardian is a staff member", required: false },
          {
            key: "sibling_name",
            type: "text",
            label: "Sibling's name",
            required: true,
            showIf: { field: "sibling", operator: "equals", value: true },
          },
          { key: "household", type: "section", label: "Household", required: false },
          {
            key: "guardians",
            type: "repeating",
            label: "Parent / guardian",
            required: true,
            minRepeat: 1,
            maxRepeat: 4,
            fields: [
              { key: "name", type: "text", label: "Full name", required: true },
              { key: "email", type: "email", label: "Email", required: true },
              { key: "phone", type: "phone", label: "Phone", required: false },
            ],
          },
          {
            key: "agree_policies",
            type: "checkbox",
            label: "I have read and agree to the school policies",
            required: true,
          },
        ],
      },
    })
    .select("id")
    .single();
  const formVersionId = formVersion!.id as string;

  // Families, students, and applications across every stage.
  const seedApps: {
    parentIndex: number;
    family: string;
    student: [string, string];
    grade: string;
    stage: string;
    sibling?: boolean;
    staff?: boolean;
  }[] = [
    { parentIndex: 0, family: "Patel Family", student: ["Aanya", "Patel"], grade: "K", stage: "started" },
    { parentIndex: 1, family: "Lee Family", student: ["Mina", "Lee"], grade: "K", stage: "submitted", sibling: true },
    { parentIndex: 2, family: "Alvarez Family", student: ["Diego", "Alvarez"], grade: "K", stage: "submitted" },
    { parentIndex: 3, family: "Kim Family", student: ["Hana", "Kim"], grade: "K", stage: "under_review", staff: true },
    { parentIndex: 4, family: "Johnson Family", student: ["Zuri", "Johnson"], grade: "K", stage: "submitted" },
    { parentIndex: 5, family: "Novak Family", student: ["Emil", "Novak"], grade: "K", stage: "submitted" },
    { parentIndex: 1, family: "Lee Family", student: ["Noah", "Lee"], grade: "6", stage: "offered" },
    { parentIndex: 2, family: "Alvarez Family", student: ["Lucia", "Alvarez"], grade: "1", stage: "accepted" },
    { parentIndex: 3, family: "Kim Family", student: ["Jae", "Kim"], grade: "6", stage: "enrolled" },
    { parentIndex: 4, family: "Johnson Family", student: ["Kofi", "Johnson"], grade: "1", stage: "waitlisted" },
    { parentIndex: 5, family: "Novak Family", student: ["Vera", "Novak"], grade: "1", stage: "declined" },
  ];

  const familyIdByName = new Map<string, string>();
  let applicationCount = 0;
  for (const app of seedApps) {
    let familyId = familyIdByName.get(app.family);
    if (!familyId) {
      const { data: family } = await db
        .from("families")
        .insert({ tenant_id: tenantId, name: app.family })
        .select("id")
        .single();
      familyId = family!.id as string;
      familyIdByName.set(app.family, familyId);
      await db.from("family_guardians").insert({
        family_id: familyId,
        user_id: parentIds[app.parentIndex],
        relationship: "parent",
      });
    }

    const { data: student } = await db
      .from("students")
      .insert({
        tenant_id: tenantId,
        family_id: familyId,
        first_name: app.student[0],
        last_name: app.student[1],
        date_of_birth: "2019-04-15",
      })
      .select("id")
      .single();

    const submitted = app.stage !== "started";
    const { data: application } = await db
      .from("applications")
      .insert({
        tenant_id: tenantId,
        period_id: periodId,
        family_id: familyId,
        student_id: student!.id,
        form_version_id: formVersionId,
        grade_applying: app.grade,
        stage_id: stageId(app.stage),
        submitted_at: submitted ? new Date().toISOString() : null,
        created_by: parentIds[app.parentIndex],
        responses: submitted
          ? {
              previous_school: "Sunny Start Preschool",
              shirt_size: "s",
              sibling: app.sibling ?? false,
              staff_child: app.staff ?? false,
              ...(app.sibling ? { sibling_name: "Noah Lee" } : {}),
              guardians: [
                {
                  name: parentNames[app.parentIndex],
                  email: `parent${app.parentIndex + 1}@demo.enrollly.test`,
                  phone: "555-0100",
                },
              ],
              agree_policies: true,
            }
          : {},
      })
      .select("id")
      .single();
    applicationCount++;

    if (submitted && requirements) {
      await db.from("application_documents").insert(
        requirements.map((r) => ({
          tenant_id: tenantId,
          application_id: application!.id,
          requirement_id: r.id,
        }))
      );
    }
  }

  // A ready-to-run kindergarten lottery (2 seats, 5 submitted applicants).
  await db.from("lotteries").insert({
    tenant_id: tenantId,
    period_id: periodId,
    grade: "K",
    seed: "demo-seed-2026-kindergarten",
    weights: { sibling: 2, staff_child: 2, zone: 1 },
  });

  console.log(`\nDone! Seeded ${applicationCount} applications.`);
  console.log(`School:        http://localhost:3000/s/${SLUG}`);
  console.log(`Admin login:   admin@demo.enrollly.test / ${PASSWORD}`);
  console.log(`Parent logins: parent1..6@demo.enrollly.test / ${PASSWORD}`);
  console.log(`Lottery:       Grade K, 2 seats, seed "demo-seed-2026-kindergarten" — run it from /admin/lottery`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
