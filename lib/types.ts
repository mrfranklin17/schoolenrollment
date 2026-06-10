/**
 * Application-level row types matching the Supabase schema.
 * (Generated Database types can replace these once `supabase gen types`
 * is wired up against the project.)
 */

export type MembershipRole = "school_admin" | "staff" | "guardian";

export type StageCategory =
  | "in_progress"
  | "submitted"
  | "in_review"
  | "offered"
  | "accepted"
  | "enrolled"
  | "waitlisted"
  | "declined"
  | "withdrawn";

export type DocumentStatus = "missing" | "submitted" | "verified" | "rejected";

export type PaymentStatus = "not_required" | "pending" | "paid" | "waived";

export type OfferStatus = "pending" | "accepted" | "declined" | "expired";

export type LotteryStatus = "draft" | "run" | "finalized";

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  settings: Record<string, unknown>;
  trial_ends_at: string;
  subscription_status: string;
  created_at: string;
}

export interface TenantPublic {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
}

export interface Membership {
  id: string;
  tenant_id: string;
  user_id: string;
  role: MembershipRole;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
}

export interface Family {
  id: string;
  tenant_id: string;
  name: string;
}

export interface Student {
  id: string;
  tenant_id: string;
  family_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  current_grade: string | null;
  demographics: Record<string, unknown>;
  sis_id: string | null;
  is_returning: boolean;
}

export interface EnrollmentPeriod {
  id: string;
  tenant_id: string;
  academic_year: string;
  name: string;
  opens_at: string | null;
  closes_at: string | null;
  is_active: boolean;
}

export interface GradeCapacity {
  id: string;
  tenant_id: string;
  period_id: string;
  grade: string;
  seats: number;
}

export interface PipelineStage {
  id: string;
  tenant_id: string;
  key: string;
  label: string;
  category: StageCategory;
  position: number;
}

export interface FormTemplate {
  id: string;
  tenant_id: string;
  period_id: string | null;
  name: string;
  grade_levels: string[] | null;
}

export interface FormVersion {
  id: string;
  tenant_id: string;
  template_id: string;
  version: number;
  schema: import("@/lib/forms/schema").FormSchema;
  published_at: string | null;
}

export interface Application {
  id: string;
  tenant_id: string;
  period_id: string;
  family_id: string;
  student_id: string;
  form_version_id: string;
  grade_applying: string;
  responses: Record<string, unknown>;
  stage_id: string;
  submitted_at: string | null;
  fee_waived: boolean;
  payment_status: PaymentStatus;
  created_at: string;
  updated_at: string;
}

export interface ApplicationNote {
  id: string;
  tenant_id: string;
  application_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
}

export interface DocumentRequirement {
  id: string;
  tenant_id: string;
  period_id: string | null;
  name: string;
  description: string | null;
  required: boolean;
  position: number;
}

export interface ApplicationDocument {
  id: string;
  tenant_id: string;
  application_id: string;
  requirement_id: string;
  storage_path: string | null;
  file_name: string | null;
  status: DocumentStatus;
  rejection_reason: string | null;
  uploaded_at: string | null;
  verified_at: string | null;
}

export interface AuditLogEntry {
  id: number;
  tenant_id: string;
  actor_id: string | null;
  entity_type: string;
  entity_id: string;
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
}

export interface Lottery {
  id: string;
  tenant_id: string;
  period_id: string;
  grade: string | null;
  seed: string;
  weights: Record<string, number>;
  status: LotteryStatus;
  run_at: string | null;
  results: Record<string, unknown> | null;
}

export interface Offer {
  id: string;
  tenant_id: string;
  application_id: string;
  status: OfferStatus;
  extended_at: string;
  expires_at: string | null;
  responded_at: string | null;
}

export interface EmailTemplate {
  id: string;
  tenant_id: string;
  key: string;
  name: string;
  subject: string;
  body: string;
}

export const GRADES = [
  "PK",
  "K",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
] as const;

export type Grade = (typeof GRADES)[number];
