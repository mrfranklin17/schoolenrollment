/** Built-in template slots schools can customize. */
export const TEMPLATE_KEYS = [
  { key: "submission_received", name: "Application submitted" },
  { key: "status_changed", name: "Status changed" },
  { key: "missing_documents", name: "Missing documents reminder" },
  { key: "decision", name: "Decision letter" },
  { key: "offer_extended", name: "Offer extended" },
  { key: "offer_expiring", name: "Offer expiring soon" },
] as const;

export const MERGE_FIELDS = [
  "guardian_name",
  "student_first_name",
  "school_name",
  "grade",
  "period_name",
  "academic_year",
  "portal_url",
  "stage_label",
] as const;
