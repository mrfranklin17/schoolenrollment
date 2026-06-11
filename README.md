# Enrollly — School Enrollment Platform

A multi-tenant SaaS enrollment platform for private, charter, and micro schools — a modern,
affordable SchoolMint alternative. Schools build custom application forms, families apply and
upload documents from any device, and admins run the whole admissions pipeline: review,
lotteries, waitlists, offers, communications, and SIS export.

## Features

- **Multi-tenant** — every school is an isolated tenant; one account can belong to several
  schools (e.g. a parent with kids at two schools). Isolation is enforced with Postgres RLS on
  every table, not just app code.
- **Form builder** — versioned application forms with text/select/date/file/signature fields,
  conditional logic, repeating sections (multiple guardians), and per-grade variants. Published
  versions are immutable; applications snapshot the version they used.
- **Parent portal** — mobile-friendly apply / save-draft / submit flow, document checklist with
  per-item status (missing / submitted / verified / rejected with reason), offer accept/decline.
- **Admin pipeline** — list + kanban views, customizable stages, bulk stage moves with optional
  family email, internal notes, full audit trail on every state change.
- **Lottery & waitlist** — deterministic seeded draws (weighted sibling / staff-child / zone
  preferences) that are exactly reproducible for audits, auto-ranked waitlists, expiring offers.
- **Communications** — customizable templates with merge fields, automatic status emails, bulk
  email by stage, per-applicant send log. Resend in production, console fallback in dev.
- **SIS interoperability** — roster CSV import with column mapping (powers re-enrollment:
  guardians who sign up with an imported email are auto-linked to their family), flat CSV export
  with a column picker, and a OneRoster 1.2 CSV bundle for PowerSchool / Infinite Campus /
  Skyward / etc. A provider interface in `lib/integrations` is ready for direct API connectors.
- **FERPA-aware** — student PII lives only in `students` and form responses; documents are
  stored under opaque UUID paths in a private bucket and served via short-lived signed URLs; no
  student names in URLs or logs.

## Stack

Next.js 15 (App Router, TypeScript strict) · Supabase (Postgres + Auth + Storage + RLS) ·
Tailwind CSS v4 + shadcn/ui · zod · Resend · Vercel.

## Getting started

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Apply the migrations in order — either `supabase db push` with the
   [Supabase CLI](https://supabase.com/docs/guides/local-development) linked to your project, or
   paste each `supabase/migrations/*.sql` file into the SQL editor (they're numbered).
3. The `documents` storage bucket and its policies are created by the migrations.

### 2. Environment

```bash
cp .env.example .env.local
```

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Project URL (Settings → API) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ (server only) | Email log writes, seed script, RLS tests |
| `RESEND_API_KEY` | optional | Real email sending; console logging without it |
| `EMAIL_FROM` | optional | From address, e.g. `School <noreply@yourdomain>` |
| `NEXT_PUBLIC_APP_URL` | ✅ in prod | Used in email links |
| `NEXT_PUBLIC_ROOT_DOMAIN` | optional | Enables `<school>.yourdomain.com` subdomains |

### 3. Run

```bash
npm install
npm run dev
```

### 4. Seed a demo school (optional, recommended)

```bash
npm run seed
```

Creates **Demo Academy** at `/s/demo-academy` with a published form, six families, applicants
in every pipeline stage, a document checklist, and a kindergarten lottery (2 seats, 5
applicants, fixed seed) ready to run from **Admin → Lottery**.

- Admin: `admin@demo.enrollly.test` / `demo1234!`
- Parents: `parent1@demo.enrollly.test` … `parent6` / `demo1234!`

### 5. Prove tenant isolation

```bash
npm run test:rls
```

Creates two throwaway tenants, verifies cross-tenant reads/writes are blocked and that
guardians can't access staff-only data, then cleans up. Exits non-zero on any failure.

## Deployment (Vercel)

1. Push to GitHub and import the repo in Vercel.
2. Set the environment variables above (Production + Preview).
3. Every push to `main` auto-deploys.
4. For per-school subdomains later: add a wildcard domain (`*.yourdomain.com`) in Vercel, set
   `NEXT_PUBLIC_ROOT_DOMAIN`, and the existing middleware handles the rest.

## Architecture notes

- **Tenant routing** is path-based (`/s/<slug>/…`); `middleware.ts` also rewrites
  `<slug>.<root-domain>` to the same routes, so subdomains are a config change, not a refactor.
- **Roles**: `school_admin`, `staff`, `guardian` (per tenant, in `memberships`). Server actions
  gate with `requireStaff` / `requireMember`; RLS is the enforcement backstop.
- **Audit log** is append-only via the `log_audit()` security-definer function; there is no
  insert policy on the table itself.
- **Lottery** uses Efraimidis–Spirakis weighted sampling over `sha256(seed:applicationId)`
  draws — rerunning with the stored seed always reproduces the ranking (`lib/lottery/run.ts`).
- **Payments (Stripe)** are intentionally deferred: the schema already carries
  `payment_status` / `fee_waived` per application and subscription fields per tenant, so
  Checkout/Billing can be added without migrations.

## Out of MVP scope (architected for, not built)

Direct SIS API connectors (PowerSchool plugin, OneRoster REST, Clever/ClassLink), SMS,
multi-language forms, district dashboards, tuition management, native mobile apps.
