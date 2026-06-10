"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import type { FormField, FormSchema, FieldType } from "@/lib/forms/schema";
import { saveFormDraft, publishFormDraft } from "@/lib/forms/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Text",
  textarea: "Long text",
  email: "Email",
  phone: "Phone",
  date: "Date",
  select: "Dropdown",
  multi_select: "Multi-select",
  checkbox: "Acknowledgment checkbox",
  file: "File upload",
  section: "Section header",
  repeating: "Repeating section",
};

function keyFromLabel(label: string, existing: Set<string>): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "field";
  let key = base;
  let i = 2;
  while (existing.has(key)) key = `${base}_${i++}`;
  return key;
}

function newField(type: FieldType, existingKeys: Set<string>): FormField {
  const label = FIELD_TYPE_LABELS[type];
  return {
    key: keyFromLabel(label, existingKeys),
    type,
    label,
    required: false,
    ...(type === "select" || type === "multi_select"
      ? { options: [{ value: "option_1", label: "Option 1" }] }
      : {}),
    ...(type === "repeating" ? { fields: [], minRepeat: 0, maxRepeat: 5 } : {}),
  };
}

function collectKeys(fields: FormField[]): Set<string> {
  const keys = new Set<string>();
  const walk = (fs: FormField[]) => {
    for (const f of fs) {
      keys.add(f.key);
      if (f.fields) walk(f.fields);
    }
  };
  walk(fields);
  return keys;
}

function FieldEditor({
  field,
  allFields,
  onChange,
  nested,
}: {
  field: FormField;
  allFields: FormField[];
  onChange: (f: FormField) => void;
  nested?: boolean;
}) {
  const conditionCandidates = allFields.filter(
    (f) => f.key !== field.key && f.type !== "section" && f.type !== "repeating" && f.type !== "file"
  );

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Label</Label>
          <Input
            value={field.label}
            onChange={(e) => onChange({ ...field, label: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Field key</Label>
          <Input
            value={field.key}
            className="font-mono"
            onChange={(e) =>
              onChange({ ...field, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })
            }
          />
        </div>
      </div>
      {field.type !== "section" && (
        <div className="space-y-1.5">
          <Label>Help text (optional)</Label>
          <Input
            value={field.helpText ?? ""}
            onChange={(e) => onChange({ ...field, helpText: e.target.value || undefined })}
          />
        </div>
      )}
      {(field.type === "select" || field.type === "multi_select") && (
        <div className="space-y-1.5">
          <Label>Options (one per line)</Label>
          <Textarea
            value={(field.options ?? []).map((o) => o.label).join("\n")}
            rows={4}
            onChange={(e) =>
              onChange({
                ...field,
                options: e.target.value
                  .split("\n")
                  .filter((l) => l.trim())
                  .map((label) => ({
                    label: label.trim(),
                    value: label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_"),
                  })),
              })
            }
          />
        </div>
      )}
      {field.type === "repeating" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Minimum entries</Label>
            <Input
              type="number"
              min={0}
              value={field.minRepeat ?? 0}
              onChange={(e) => onChange({ ...field, minRepeat: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Maximum entries</Label>
            <Input
              type="number"
              min={1}
              value={field.maxRepeat ?? 5}
              onChange={(e) => onChange({ ...field, maxRepeat: Number(e.target.value) })}
            />
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-6">
        {field.type !== "section" && (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={field.required}
              onCheckedChange={(v) => onChange({ ...field, required: v === true })}
            />
            Required
          </label>
        )}
        {!nested && conditionCandidates.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Show only when</span>
            <Select
              value={field.showIf?.field ?? "__always__"}
              onValueChange={(v) =>
                onChange({
                  ...field,
                  showIf:
                    v === "__always__"
                      ? undefined
                      : { field: v, operator: field.showIf?.operator ?? "equals", value: field.showIf?.value ?? "" },
                })
              }
            >
              <SelectTrigger className="h-8 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__always__">Always show</SelectItem>
                {conditionCandidates.map((f) => (
                  <SelectItem key={f.key} value={f.key}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {field.showIf && (
              <>
                <Select
                  value={field.showIf.operator}
                  onValueChange={(v) =>
                    onChange({
                      ...field,
                      showIf: { ...field.showIf!, operator: v as NonNullable<FormField["showIf"]>["operator"] },
                    })
                  }
                >
                  <SelectTrigger className="h-8 w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equals">equals</SelectItem>
                    <SelectItem value="not_equals">doesn&apos;t equal</SelectItem>
                    <SelectItem value="contains">contains</SelectItem>
                    <SelectItem value="not_empty">is answered</SelectItem>
                  </SelectContent>
                </Select>
                {field.showIf.operator !== "not_empty" && (
                  <Input
                    className="h-8 w-36"
                    value={String(field.showIf.value ?? "")}
                    placeholder="value"
                    onChange={(e) =>
                      onChange({ ...field, showIf: { ...field.showIf!, value: e.target.value } })
                    }
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FieldList({
  fields,
  allFields,
  onChange,
  nested,
}: {
  fields: FormField[];
  allFields: FormField[];
  onChange: (fields: FormField[]) => void;
  nested?: boolean;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  const move = (i: number, dir: -1 | 1) => {
    const next = [...fields];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {fields.map((field, i) => (
        <div key={field.key} className="rounded-lg border bg-background">
          <div className="flex items-center gap-2 px-3 py-2">
            <button
              type="button"
              className="flex-1 text-left"
              onClick={() => setOpenKey(openKey === field.key ? null : field.key)}
            >
              <span className="font-medium">{field.label}</span>{" "}
              <Badge variant="secondary" className="ml-2">
                {FIELD_TYPE_LABELS[field.type]}
              </Badge>
              {field.required && (
                <Badge variant="outline" className="ml-1">
                  required
                </Badge>
              )}
              {field.showIf && (
                <Badge variant="outline" className="ml-1">
                  conditional
                </Badge>
              )}
            </button>
            <Button variant="ghost" size="icon" onClick={() => move(i, -1)} disabled={i === 0}>
              <ArrowUp />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => move(i, 1)}
              disabled={i === fields.length - 1}
            >
              <ArrowDown />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive"
              onClick={() => onChange(fields.filter((_, j) => j !== i))}
            >
              <Trash2 />
            </Button>
          </div>
          {openKey === field.key && (
            <div className="border-t px-3 py-3">
              <FieldEditor
                field={field}
                allFields={allFields}
                nested={nested}
                onChange={(f) => onChange(fields.map((x, j) => (j === i ? f : x)))}
              />
              {field.type === "repeating" && (
                <div className="mt-4 space-y-2 rounded-md bg-muted/40 p-3">
                  <p className="text-sm font-medium">Fields in each entry</p>
                  <FieldList
                    fields={field.fields ?? []}
                    allFields={field.fields ?? []}
                    nested
                    onChange={(children) =>
                      onChange(fields.map((x, j) => (j === i ? { ...x, fields: children } : x)))
                    }
                  />
                  <AddFieldButton
                    exclude={["repeating", "file", "section"]}
                    onAdd={(type) => {
                      const child = newField(type, collectKeys(allFields));
                      onChange(
                        fields.map((x, j) =>
                          j === i ? { ...x, fields: [...(x.fields ?? []), child] } : x
                        )
                      );
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function AddFieldButton({
  onAdd,
  exclude = [],
}: {
  onAdd: (type: FieldType) => void;
  exclude?: FieldType[];
}) {
  return (
    <Select value="" onValueChange={(v) => onAdd(v as FieldType)}>
      <SelectTrigger className="w-52">
        <Plus className="h-4 w-4" />
        <SelectValue placeholder="Add a field" />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(FIELD_TYPE_LABELS) as FieldType[])
          .filter((t) => !exclude.includes(t))
          .map((t) => (
            <SelectItem key={t} value={t}>
              {FIELD_TYPE_LABELS[t]}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}

export function FormBuilder({
  school,
  templateId,
  initialSchema,
  isDraft,
  publishedVersion,
}: {
  school: string;
  templateId: string;
  initialSchema: FormSchema;
  isDraft: boolean;
  publishedVersion: number | null;
}) {
  const [schema, setSchema] = useState<FormSchema>(initialSchema);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const save = (thenPublish: boolean) => {
    setMessage(null);
    startTransition(async () => {
      const result = await saveFormDraft({ school, templateId, schema });
      if (result?.error) {
        setMessage({ kind: "error", text: result.error });
        return;
      }
      if (thenPublish) {
        const pub = await publishFormDraft({ school, templateId });
        if (pub?.error) {
          setMessage({ kind: "error", text: pub.error });
          return;
        }
        setMessage({ kind: "ok", text: "Form published. Families now see this version." });
      } else {
        setMessage({ kind: "ok", text: "Draft saved." });
      }
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Form details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Title shown to families</Label>
            <Input
              value={schema.title}
              onChange={(e) => setSchema({ ...schema, title: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Introduction (optional)</Label>
            <Textarea
              value={schema.description ?? ""}
              rows={3}
              onChange={(e) => setSchema({ ...schema, description: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Fields</CardTitle>
          <AddFieldButton
            onAdd={(type) =>
              setSchema({
                ...schema,
                fields: [...schema.fields, newField(type, collectKeys(schema.fields))],
              })
            }
          />
        </CardHeader>
        <CardContent>
          {schema.fields.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No fields yet — add your first field above.
            </p>
          ) : (
            <FieldList
              fields={schema.fields}
              allFields={schema.fields}
              onChange={(fields) => setSchema({ ...schema, fields })}
            />
          )}
        </CardContent>
      </Card>

      {message && (
        <Alert variant={message.kind === "error" ? "destructive" : "default"}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      <Separator />
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {publishedVersion
            ? `Version ${publishedVersion} is live.`
            : "Not published yet — families can't see this form."}
          {isDraft && " You have unsaved draft changes stored as the next version."}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => save(false)} disabled={pending}>
            {pending ? "Saving…" : "Save draft"}
          </Button>
          <Button onClick={() => save(true)} disabled={pending}>
            Publish
          </Button>
        </div>
      </div>
    </div>
  );
}
