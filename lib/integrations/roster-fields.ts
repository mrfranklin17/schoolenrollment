/** Student fields a roster CSV column can map onto. */
export const ROSTER_FIELDS = [
  { key: "first_name", label: "First name", required: true },
  { key: "last_name", label: "Last name", required: true },
  { key: "sis_id", label: "SIS / student ID", required: false },
  { key: "date_of_birth", label: "Date of birth (YYYY-MM-DD)", required: false },
  { key: "grade", label: "Current grade", required: false },
  { key: "guardian_email", label: "Guardian email (links re-enrollment)", required: false },
] as const;

/** Columns available for the flat CSV applications export. */
export const EXPORT_FIELDS = [
  { key: "student_first_name", label: "Student first name" },
  { key: "student_last_name", label: "Student last name" },
  { key: "student_dob", label: "Date of birth" },
  { key: "sis_id", label: "SIS / student ID" },
  { key: "grade_applying", label: "Grade applying" },
  { key: "stage", label: "Pipeline stage" },
  { key: "period", label: "Enrollment period" },
  { key: "academic_year", label: "Academic year" },
  { key: "family_name", label: "Family" },
  { key: "guardian_emails", label: "Guardian emails" },
  { key: "submitted_at", label: "Submitted at" },
  { key: "payment_status", label: "Payment status" },
] as const;

export type ExportFieldKey = (typeof EXPORT_FIELDS)[number]["key"];
