"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { FormResponses, FormSchema } from "@/lib/forms/schema";
import { saveApplicationDraft, submitApplication } from "@/lib/portal/actions";
import { FormRenderer } from "@/components/form-engine/form-renderer";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function ApplicationEditor({
  school,
  applicationId,
  schema,
  initialResponses,
  submitted,
}: {
  school: string;
  applicationId: string;
  schema: FormSchema;
  initialResponses: FormResponses;
  submitted: boolean;
}) {
  const router = useRouter();
  const [responses, setResponses] = useState<FormResponses>(initialResponses);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  if (submitted) {
    return (
      <div className="space-y-6">
        <Alert>
          <AlertDescription>
            This application has been submitted. The school will be in touch — you can check
            back here for status updates.
          </AlertDescription>
        </Alert>
        <FormRenderer schema={schema} responses={responses} onChange={() => {}} disabled />
      </div>
    );
  }

  const save = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await saveApplicationDraft({ school, applicationId, responses });
      setMessage(
        result?.error
          ? { kind: "error", text: result.error }
          : { kind: "ok", text: "Draft saved — you can come back anytime." }
      );
    });
  };

  const submit = () => {
    setMessage(null);
    setFieldErrors({});
    startTransition(async () => {
      const result = await submitApplication({ school, applicationId, responses });
      if (result?.error) {
        setFieldErrors(result.fieldErrors ?? {});
        setMessage({ kind: "error", text: result.error });
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <FormRenderer
        schema={schema}
        responses={responses}
        onChange={setResponses}
        errors={fieldErrors}
      />
      {message && (
        <Alert variant={message.kind === "error" ? "destructive" : "default"}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}
      <Separator />
      <div className="sticky bottom-0 -mx-4 flex flex-col-reverse gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:flex-row sm:justify-end sm:border-0 sm:bg-transparent sm:p-0">
        <Button variant="outline" onClick={save} disabled={pending}>
          {pending ? "Working…" : "Save draft"}
        </Button>
        <Button onClick={submit} disabled={pending}>
          Submit application
        </Button>
      </div>
    </div>
  );
}
