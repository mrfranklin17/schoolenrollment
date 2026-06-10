# School Enrollment Platform

Multi-tenant SaaS enrollment platform (SchoolMint alternative) for private,
charter, and micro schools.

## Stack
- Next.js 15 (App Router, TypeScript strict), Tailwind v4, hand-vendored
  shadcn/ui components in `components/ui` (registry is not reachable from CI —
  add new components by hand there).
- Supabase: Postgres + Auth + Storage. Schema and RLS live in
  `supabase/migrations/*.sql`. Every table is tenant-scoped; access helpers
  (`is_member_of`, `is_tenant_staff`, `is_tenant_admin`, `is_family_guardian`)
  are security-definer SQL functions.
- zod validation on all inputs; server actions for mutations.

## Conventions
- Tenant routing is path-based: `/s/<slug>/...`. `middleware.ts` also rewrites
  `<slug>.<NEXT_PUBLIC_ROOT_DOMAIN>` to the same routes (subdomain-ready).
- Roles: `school_admin`, `staff`, `guardian`. Server-side gating via
  `requireStaff` / `requireMember` in `lib/tenant.ts`; RLS is the backstop.
- FERPA-aware: student PII only in `students` and form responses; storage
  paths and audit entries use opaque UUIDs; no student names in URLs or logs.
- Audit every application state change via the `log_audit()` SQL function.
- Form schemas are versioned jsonb (`lib/forms/schema.ts`); published
  versions are immutable.

## Commands
- `npm run dev` / `npm run build` / `npm run lint`
