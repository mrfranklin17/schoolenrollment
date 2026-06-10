import "server-only";

import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { MembershipRole, TenantPublic } from "@/lib/types";

/** Resolve public tenant info (name, branding) from a slug. 404s if unknown. */
export async function getTenantBySlug(slug: string): Promise<TenantPublic> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("get_tenant_public", { p_slug: slug })
    .maybeSingle<TenantPublic>();

  if (error || !data) notFound();
  return data;
}

export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function requireUser(nextPath?: string) {
  const user = await getUser();
  if (!user) redirect(`/login${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`);
  return user;
}

export async function getMembershipRole(tenantId: string): Promise<MembershipRole | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("memberships")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("user_id", user.id)
    .maybeSingle<{ role: MembershipRole }>();

  return data?.role ?? null;
}

/** Require school_admin or staff for the tenant; redirects otherwise. */
export async function requireStaff(slug: string) {
  const tenant = await getTenantBySlug(slug);
  const user = await requireUser(`/s/${slug}/admin`);
  const role = await getMembershipRole(tenant.id);
  if (role !== "school_admin" && role !== "staff") {
    redirect(`/s/${slug}`);
  }
  return { tenant, user, role };
}

/** Require any membership (guardian included); redirects to login otherwise. */
export async function requireMember(slug: string) {
  const tenant = await getTenantBySlug(slug);
  const user = await requireUser(`/s/${slug}/portal`);
  const role = await getMembershipRole(tenant.id);
  return { tenant, user, role };
}
