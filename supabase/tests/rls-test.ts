/**
 * Tenant-isolation proof: demonstrates that RLS prevents cross-tenant reads
 * and writes, and that guardians can't see staff-only data.
 *
 * Usage:
 *   npx tsx --env-file=.env.local supabase/tests/rls-test.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and
 * SUPABASE_SERVICE_ROLE_KEY. Creates throwaway tenants/users, verifies
 * isolation, then cleans up. Exits non-zero on any failure.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) {
  console.error(
    "Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY"
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let failures = 0;
function check(name: string, passed: boolean, detail?: string) {
  console.log(`${passed ? "✓ PASS" : "✗ FAIL"}  ${name}${detail && !passed ? ` — ${detail}` : ""}`);
  if (!passed) failures++;
}

const STAMP = Date.now();
const PASSWORD = "rls-test-password-1!";

async function createUser(email: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: "RLS Test" },
  });
  if (error || !data.user) throw error ?? new Error("user create failed");
  return data.user.id;
}

async function signIn(email: string) {
  const client = createClient(url!, anonKey!, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

async function main() {
  console.log("Setting up two tenants with one user each…\n");

  const userA = await createUser(`rls-a-${STAMP}@test.enrollly.test`);
  const userB = await createUser(`rls-b-${STAMP}@test.enrollly.test`);

  const { data: tenants } = await admin
    .from("tenants")
    .insert([
      { slug: `rls-test-a-${STAMP}`, name: "RLS Tenant A" },
      { slug: `rls-test-b-${STAMP}`, name: "RLS Tenant B" },
    ])
    .select("id, slug");
  const tenantA = tenants![0].id as string;
  const tenantB = tenants![1].id as string;

  await admin.from("memberships").insert([
    { tenant_id: tenantA, user_id: userA, role: "school_admin" },
    { tenant_id: tenantB, user_id: userB, role: "school_admin" },
  ]);

  const { data: families } = await admin
    .from("families")
    .insert([
      { tenant_id: tenantA, name: "Family A" },
      { tenant_id: tenantB, name: "Family B" },
    ])
    .select("id");
  const familyA = families![0].id as string;
  const familyB = families![1].id as string;

  const { data: students } = await admin
    .from("students")
    .insert([
      { tenant_id: tenantA, family_id: familyA, first_name: "Alice", last_name: "TenantA" },
      { tenant_id: tenantB, family_id: familyB, first_name: "Bob", last_name: "TenantB" },
    ])
    .select("id");
  const studentB = students![1].id as string;

  try {
    const clientA = await signIn(`rls-a-${STAMP}@test.enrollly.test`);

    // 1. Admin of tenant A sees only tenant A students.
    const { data: visibleStudents } = await clientA
      .from("students")
      .select("id, tenant_id")
      .in("tenant_id", [tenantA, tenantB]);
    check(
      "tenant A staff cannot read tenant B students",
      (visibleStudents ?? []).every((s) => s.tenant_id === tenantA) &&
        (visibleStudents ?? []).length === 1,
      `saw ${(visibleStudents ?? []).length} rows`
    );

    // 2. Direct lookup of a tenant B row returns nothing.
    const { data: crossRead } = await clientA
      .from("students")
      .select("id")
      .eq("id", studentB)
      .maybeSingle();
    check("direct read of tenant B student returns nothing", crossRead === null);

    // 3. Cross-tenant insert is rejected.
    const { error: insertError } = await clientA.from("students").insert({
      tenant_id: tenantB,
      family_id: familyB,
      first_name: "Mallory",
      last_name: "Injected",
    });
    check("insert into tenant B is rejected", insertError !== null);

    // 4. Cross-tenant update silently affects no rows.
    await clientA.from("students").update({ first_name: "Hacked" }).eq("id", studentB);
    const { data: afterUpdate } = await admin
      .from("students")
      .select("first_name")
      .eq("id", studentB)
      .single();
    check("update of tenant B student has no effect", afterUpdate?.first_name === "Bob");

    // 5. Tenant B's tenant row is invisible.
    const { data: visibleTenants } = await clientA
      .from("tenants")
      .select("id")
      .in("id", [tenantA, tenantB]);
    check(
      "tenant B is invisible in tenants table",
      (visibleTenants ?? []).length === 1 && visibleTenants![0].id === tenantA
    );

    // 6. A guardian cannot read internal notes even in their own tenant.
    const guardianId = await createUser(`rls-g-${STAMP}@test.enrollly.test`);
    await admin.from("memberships").insert({
      tenant_id: tenantA,
      user_id: guardianId,
      role: "guardian",
    });
    const clientG = await signIn(`rls-g-${STAMP}@test.enrollly.test`);
    const { data: notes } = await clientG.from("application_notes").select("id");
    check("guardian cannot read internal application notes", (notes ?? []).length === 0);

    // 7. Guardian sees no students without a family link.
    const { data: guardianStudents } = await clientG.from("students").select("id");
    check("guardian without family link sees no students", (guardianStudents ?? []).length === 0);

    await admin.auth.admin.deleteUser(guardianId);
  } finally {
    console.log("\nCleaning up…");
    await admin.from("tenants").delete().in("id", [tenantA, tenantB]);
    await admin.auth.admin.deleteUser(userA);
    await admin.auth.admin.deleteUser(userB);
  }

  console.log(failures === 0 ? "\nAll RLS checks passed." : `\n${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
