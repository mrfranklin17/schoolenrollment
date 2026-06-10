import { z } from "zod";

/**
 * Versioned form schema. A FormVersion row stores one of these as jsonb;
 * applications snapshot-reference the exact version they were filled against.
 */

export const FIELD_TYPES = [
  "text",
  "textarea",
  "email",
  "phone",
  "date",
  "select",
  "multi_select",
  "checkbox", // single acknowledgment / signature checkbox
  "file",
  "section", // visual grouping header
  "repeating", // repeating group of child fields (e.g. multiple guardians)
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export const conditionSchema = z.object({
  /** key of the field whose value drives visibility */
  field: z.string(),
  operator: z.enum(["equals", "not_equals", "contains", "not_empty"]),
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
});

export type Condition = z.infer<typeof conditionSchema>;

const baseFieldSchema = z.object({
  /** stable key used in application responses */
  key: z.string().regex(/^[a-z0-9_]+$/, "lowercase letters, numbers, underscores"),
  type: z.enum(FIELD_TYPES),
  label: z.string().min(1),
  helpText: z.string().optional(),
  required: z.boolean().default(false),
  /** show this field only when the condition holds */
  showIf: conditionSchema.optional(),
  /** for select / multi_select */
  options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
  /** for file fields: link to a document requirement checklist item */
  requirementId: z.string().uuid().optional(),
  placeholder: z.string().optional(),
});

export type FormField = z.infer<typeof baseFieldSchema> & {
  /** for repeating sections */
  fields?: FormField[];
  minRepeat?: number;
  maxRepeat?: number;
};

export const fieldSchema: z.ZodType<FormField> = baseFieldSchema.extend({
  fields: z.lazy(() => z.array(fieldSchema)).optional(),
  minRepeat: z.number().int().min(0).optional(),
  maxRepeat: z.number().int().min(1).optional(),
}) as z.ZodType<FormField>;

export const formSchemaSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  fields: z.array(fieldSchema),
});

export type FormSchema = z.infer<typeof formSchemaSchema>;

export type ResponseValue =
  | string
  | number
  | boolean
  | string[]
  | Record<string, unknown>[]
  | null;

export type FormResponses = Record<string, ResponseValue>;

/** Evaluate a conditional-visibility rule against current responses. */
export function isFieldVisible(field: FormField, responses: FormResponses): boolean {
  if (!field.showIf) return true;
  const actual = responses[field.showIf.field];
  switch (field.showIf.operator) {
    case "equals":
      return actual === field.showIf.value;
    case "not_equals":
      return actual !== field.showIf.value;
    case "contains":
      return Array.isArray(actual) && (actual as unknown[]).includes(String(field.showIf.value));
    case "not_empty":
      return actual !== null && actual !== undefined && actual !== "" &&
        (!Array.isArray(actual) || actual.length > 0);
  }
}

/**
 * Validate submitted responses against a form schema.
 * Returns a map of field key -> error message (empty when valid).
 * Hidden fields (failed showIf) are never required.
 */
export function validateResponses(
  schema: FormSchema,
  responses: FormResponses
): Record<string, string> {
  const errors: Record<string, string> = {};

  const validateFields = (fields: FormField[], values: FormResponses, prefix = "") => {
    for (const field of fields) {
      if (field.type === "section") continue;
      if (!isFieldVisible(field, values)) continue;

      const value = values[field.key];
      const path = prefix + field.key;

      if (field.type === "repeating") {
        const rows = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
        const min = field.minRepeat ?? (field.required ? 1 : 0);
        if (rows.length < min) {
          errors[path] = `At least ${min} ${min === 1 ? "entry is" : "entries are"} required`;
          continue;
        }
        rows.forEach((row, i) => {
          validateFields(field.fields ?? [], row as FormResponses, `${path}[${i}].`);
        });
        continue;
      }

      const empty =
        value === null ||
        value === undefined ||
        value === "" ||
        value === false ||
        (Array.isArray(value) && value.length === 0);

      if (field.required && empty) {
        errors[path] = "This field is required";
        continue;
      }
      if (empty) continue;

      if (field.type === "email" && typeof value === "string") {
        if (!z.string().email().safeParse(value).success) {
          errors[path] = "Enter a valid email address";
        }
      }
      if (field.type === "date" && typeof value === "string") {
        if (Number.isNaN(Date.parse(value))) {
          errors[path] = "Enter a valid date";
        }
      }
      if ((field.type === "select" || field.type === "multi_select") && field.options) {
        const allowed = new Set(field.options.map((o) => o.value));
        const picked = Array.isArray(value) ? (value as string[]) : [String(value)];
        if (picked.some((v) => !allowed.has(v))) {
          errors[path] = "Invalid selection";
        }
      }
    }
  };

  validateFields(schema.fields, responses);
  return errors;
}
