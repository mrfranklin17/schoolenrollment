"use client";

import { useActionState, useState } from "react";

import { sendBulkEmail, upsertEmailTemplate, type CommsActionState } from "@/lib/comms/actions";
import { MERGE_FIELDS } from "@/lib/comms/templates";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

function MergeFieldHints() {
  return (
    <div className="flex flex-wrap gap-1">
      {MERGE_FIELDS.map((f) => (
        <Badge key={f} variant="outline" className="font-mono text-xs">
          {`{{${f}}}`}
        </Badge>
      ))}
    </div>
  );
}

export function TemplateEditor({
  school,
  templateKey,
  name,
  existing,
}: {
  school: string;
  templateKey: string;
  name: string;
  existing: { subject: string; body: string } | null;
}) {
  const [state, formAction, pending] = useActionState<CommsActionState, FormData>(
    upsertEmailTemplate,
    undefined
  );
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardHeader
        className="cursor-pointer flex-row items-center justify-between space-y-0"
        onClick={() => setOpen(!open)}
      >
        <CardTitle className="text-base">{name}</CardTitle>
        <Badge variant={existing ? "success" : "secondary"}>
          {existing ? "customized" : "default"}
        </Badge>
      </CardHeader>
      {open && (
        <CardContent>
          <form action={formAction} className="space-y-3">
            <input type="hidden" name="school" value={school} />
            <input type="hidden" name="key" value={templateKey} />
            <input type="hidden" name="name" value={name} />
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input
                name="subject"
                defaultValue={existing?.subject ?? ""}
                placeholder="Update from {{school_name}}"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Body</Label>
              <Textarea
                name="body"
                rows={6}
                defaultValue={existing?.body ?? ""}
                placeholder={"Hi {{guardian_name}},\n\n…\n\n— {{school_name}}"}
                required
              />
            </div>
            <MergeFieldHints />
            {state?.error && (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            )}
            {state?.ok && (
              <Alert>
                <AlertDescription>Template saved.</AlertDescription>
              </Alert>
            )}
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Saving…" : "Save template"}
            </Button>
          </form>
        </CardContent>
      )}
    </Card>
  );
}

export function BulkEmailForm({
  school,
  stages,
}: {
  school: string;
  stages: { id: string; label: string }[];
}) {
  const [state, formAction, pending] = useActionState<CommsActionState, FormData>(
    sendBulkEmail,
    undefined
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="school" value={school} />
      <div className="space-y-2">
        <Label>Send to families in stage</Label>
        <Select name="stageId" required>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Choose a stage" />
          </SelectTrigger>
          <SelectContent>
            {stages.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Subject</Label>
        <Input name="subject" placeholder="An update from {{school_name}}" required />
      </div>
      <div className="space-y-2">
        <Label>Message</Label>
        <Textarea name="body" rows={8} placeholder={"Hi {{guardian_name}},\n\n…"} required />
      </div>
      <MergeFieldHints />
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {state?.ok && (
        <Alert>
          <AlertDescription>
            Sent to {state.sent} application{state.sent === 1 ? "" : "s"}.
          </AlertDescription>
        </Alert>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send bulk email"}
      </Button>
    </form>
  );
}
