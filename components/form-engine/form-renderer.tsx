"use client";

import { Plus, Trash2 } from "lucide-react";

import {
  isFieldVisible,
  type FormField,
  type FormResponses,
  type FormSchema,
} from "@/lib/forms/schema";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

function FieldInput({
  field,
  value,
  onChange,
  error,
  disabled,
}: {
  field: FormField;
  value: unknown;
  onChange: (v: unknown) => void;
  error?: string;
  disabled?: boolean;
}) {
  const id = `field-${field.key}`;

  return (
    <div className="space-y-1.5">
      {field.type !== "checkbox" && (
        <Label htmlFor={id}>
          {field.label}
          {field.required && <span className="text-destructive"> *</span>}
        </Label>
      )}
      {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}

      {(field.type === "text" || field.type === "email" || field.type === "phone") && (
        <Input
          id={id}
          type={field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text"}
          value={typeof value === "string" ? value : ""}
          placeholder={field.placeholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {field.type === "textarea" && (
        <Textarea
          id={id}
          value={typeof value === "string" ? value : ""}
          placeholder={field.placeholder}
          disabled={disabled}
          rows={4}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {field.type === "date" && (
        <Input
          id={id}
          type="date"
          value={typeof value === "string" ? value : ""}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {field.type === "select" && (
        <Select
          value={typeof value === "string" ? value : ""}
          disabled={disabled}
          onValueChange={onChange}
        >
          <SelectTrigger id={id}>
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {field.type === "multi_select" && (
        <div className="space-y-2">
          {(field.options ?? []).map((o) => {
            const selected = Array.isArray(value) ? (value as string[]) : [];
            return (
              <label key={o.value} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selected.includes(o.value)}
                  disabled={disabled}
                  onCheckedChange={(checked) =>
                    onChange(
                      checked === true
                        ? [...selected, o.value]
                        : selected.filter((v) => v !== o.value)
                    )
                  }
                />
                {o.label}
              </label>
            );
          })}
        </div>
      )}

      {field.type === "checkbox" && (
        <label className="flex items-start gap-2 text-sm">
          <Checkbox
            checked={value === true}
            disabled={disabled}
            onCheckedChange={(checked) => onChange(checked === true)}
            className="mt-0.5"
          />
          <span>
            {field.label}
            {field.required && <span className="text-destructive"> *</span>}
          </span>
        </label>
      )}

      {field.type === "file" && (
        <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
          You&apos;ll upload this in the document checklist after submitting your application.
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function RepeatingGroup({
  field,
  rows,
  onChange,
  errors,
  disabled,
  pathPrefix,
}: {
  field: FormField;
  rows: Record<string, unknown>[];
  onChange: (rows: Record<string, unknown>[]) => void;
  errors: Record<string, string>;
  disabled?: boolean;
  pathPrefix: string;
}) {
  const max = field.maxRepeat ?? 10;
  return (
    <div className="space-y-3">
      <div>
        <p className="font-medium">
          {field.label}
          {field.required && <span className="text-destructive"> *</span>}
        </p>
        {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
      </div>
      {errors[pathPrefix] && <p className="text-sm text-destructive">{errors[pathPrefix]}</p>}
      {rows.map((row, i) => (
        <div key={i} className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">
              {field.label} {i + 1}
            </p>
            {!disabled && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-destructive"
                onClick={() => onChange(rows.filter((_, j) => j !== i))}
              >
                <Trash2 />
              </Button>
            )}
          </div>
          {(field.fields ?? []).map((child) =>
            isFieldVisible(child, row as FormResponses) ? (
              <FieldInput
                key={child.key}
                field={child}
                value={row[child.key]}
                disabled={disabled}
                error={errors[`${pathPrefix}[${i}].${child.key}`]}
                onChange={(v) => onChange(rows.map((r, j) => (j === i ? { ...r, [child.key]: v } : r)))}
              />
            ) : null
          )}
        </div>
      ))}
      {!disabled && rows.length < max && (
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...rows, {}])}>
          <Plus /> Add {field.label.toLowerCase()}
        </Button>
      )}
    </div>
  );
}

export function FormRenderer({
  schema,
  responses,
  onChange,
  errors = {},
  disabled,
}: {
  schema: FormSchema;
  responses: FormResponses;
  onChange: (responses: FormResponses) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
}) {
  const setValue = (key: string, value: unknown) =>
    onChange({ ...responses, [key]: value as FormResponses[string] });

  return (
    <div className="space-y-6">
      {schema.fields.map((field) => {
        if (!isFieldVisible(field, responses)) return null;

        if (field.type === "section") {
          return (
            <div key={field.key} className="border-b pb-2 pt-4">
              <h2 className="text-lg font-semibold">{field.label}</h2>
              {field.helpText && <p className="text-sm text-muted-foreground">{field.helpText}</p>}
            </div>
          );
        }

        if (field.type === "repeating") {
          const rows = Array.isArray(responses[field.key])
            ? (responses[field.key] as Record<string, unknown>[])
            : [];
          return (
            <RepeatingGroup
              key={field.key}
              field={field}
              rows={rows}
              errors={errors}
              disabled={disabled}
              pathPrefix={field.key}
              onChange={(next) => setValue(field.key, next)}
            />
          );
        }

        return (
          <FieldInput
            key={field.key}
            field={field}
            value={responses[field.key]}
            error={errors[field.key]}
            disabled={disabled}
            onChange={(v) => setValue(field.key, v)}
          />
        );
      })}
    </div>
  );
}
