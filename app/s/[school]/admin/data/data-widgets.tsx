"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { parseCsv } from "@/lib/integrations/csv";
import { importRoster } from "@/lib/integrations/actions";
import { EXPORT_FIELDS, ROSTER_FIELDS } from "@/lib/integrations/roster-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SKIP = "__skip__";

export function RosterImporter({ school }: { school: string }) {
  const router = useRouter();
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const onFile = async (file: File) => {
    setMessage(null);
    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.length < 2) {
      setMessage({ kind: "error", text: "The CSV needs a header row and at least one data row." });
      return;
    }
    setFileName(file.name);
    setHeaders(parsed[0]);
    setRows(parsed.slice(1));

    // Auto-map columns whose header resembles a known field.
    const auto: Record<string, string> = {};
    parsed[0].forEach((header, i) => {
      const h = header.toLowerCase();
      if (/first/.test(h)) auto.first_name ??= String(i);
      else if (/last|surname/.test(h)) auto.last_name ??= String(i);
      else if (/birth|dob/.test(h)) auto.date_of_birth ??= String(i);
      else if (/grade/.test(h)) auto.grade ??= String(i);
      else if (/email/.test(h)) auto.guardian_email ??= String(i);
      else if (/\bid\b|number/.test(h)) auto.sis_id ??= String(i);
    });
    setMapping(auto);
  };

  const runImport = () => {
    setMessage(null);
    const numericMapping: Record<string, number> = {};
    for (const [field, col] of Object.entries(mapping)) {
      if (col !== SKIP && col !== "") numericMapping[field] = Number(col);
    }
    startTransition(async () => {
      const result = await importRoster({
        school,
        fileName: fileName ?? "roster.csv",
        mapping: numericMapping,
        rows,
      });
      if (result?.error) {
        setMessage({ kind: "error", text: result.error });
        return;
      }
      const s = result?.stats;
      setMessage({
        kind: "ok",
        text: `Import complete: ${s?.created ?? 0} created, ${s?.updated ?? 0} updated, ${s?.skipped ?? 0} skipped.`,
      });
      setFileName(null);
      setHeaders([]);
      setRows([]);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {!fileName && (
        <div>
          <input
            id="roster-file"
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFile(file);
              e.target.value = "";
            }}
          />
          <Button asChild variant="outline">
            <label htmlFor="roster-file" className="cursor-pointer">
              Choose a CSV file
            </label>
          </Button>
        </div>
      )}

      {fileName && (
        <div className="space-y-4">
          <p className="text-sm">
            <span className="font-medium">{fileName}</span>{" "}
            <span className="text-muted-foreground">— {rows.length} rows</span>
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {ROSTER_FIELDS.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label>
                  {field.label}
                  {field.required && <span className="text-destructive"> *</span>}
                </Label>
                <Select
                  value={mapping[field.key] ?? SKIP}
                  onValueChange={(v) => setMapping({ ...mapping, [field.key]: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SKIP}>— don&apos;t import —</SelectItem>
                    {headers.map((h, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {h || `Column ${i + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button onClick={runImport} disabled={pending}>
              {pending ? "Importing…" : `Import ${rows.length} students`}
            </Button>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => {
                setFileName(null);
                setHeaders([]);
                setRows([]);
                setMessage(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {message && (
        <Alert variant={message.kind === "error" ? "destructive" : "default"}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export function ExportPanel({
  school,
  periods,
}: {
  school: string;
  periods: { id: string; name: string }[];
}) {
  const [fields, setFields] = useState<Set<string>>(new Set(EXPORT_FIELDS.map((f) => f.key)));
  const [periodId, setPeriodId] = useState<string>("all");

  const query = new URLSearchParams();
  query.set("fields", Array.from(fields).join(","));
  if (periodId !== "all") query.set("periodId", periodId);
  const flatUrl = `/api/s/${school}/export/applications?${query.toString()}`;
  const oneRosterUrl = `/api/s/${school}/export/oneroster${periodId !== "all" ? `?periodId=${periodId}` : ""}`;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Enrollment period</Label>
        <Select value={periodId} onValueChange={setPeriodId}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All periods</SelectItem>
            {periods.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Columns for the flat CSV</Label>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {EXPORT_FIELDS.map((f) => (
            <label key={f.key} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={fields.has(f.key)}
                onCheckedChange={(checked) => {
                  const next = new Set(fields);
                  if (checked === true) next.add(f.key);
                  else next.delete(f.key);
                  setFields(next);
                }}
              />
              {f.label}
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild disabled={fields.size === 0}>
          <a href={flatUrl} download>
            Download flat CSV
          </a>
        </Button>
        <Button asChild variant="outline">
          <a href={oneRosterUrl} download>
            Download OneRoster 1.2 bundle
          </a>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        The OneRoster bundle includes accepted &amp; enrolled students only and imports into
        PowerSchool, Infinite Campus, Skyward, and other OneRoster-compliant systems.
      </p>
    </div>
  );
}
