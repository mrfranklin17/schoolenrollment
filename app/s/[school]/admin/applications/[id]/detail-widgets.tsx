"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { addNote, moveApplications, setFeeWaiver, type PipelineActionState } from "@/lib/admin/pipeline-actions";
import { getDocumentSignedUrl, reviewDocument } from "@/lib/documents/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function StageControls({
  school,
  applicationId,
  stages,
  currentStageId,
  feeWaived,
}: {
  school: string;
  applicationId: string;
  stages: { id: string; label: string }[];
  currentStageId: string;
  feeWaived: boolean;
}) {
  const router = useRouter();
  const [notify, setNotify] = useState(true);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <Select
          value={currentStageId}
          disabled={pending}
          onValueChange={(stageId) =>
            startTransition(async () => {
              await moveApplications({ school, applicationIds: [applicationId], stageId, notify });
              router.refresh();
            })
          }
        >
          <SelectTrigger className="w-48">
            <SelectValue />
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
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <Checkbox checked={notify} onCheckedChange={(v) => setNotify(v === true)} />
        Email family on stage change
      </label>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <Checkbox
          checked={feeWaived}
          disabled={pending}
          onCheckedChange={(v) =>
            startTransition(async () => {
              await setFeeWaiver({ school, applicationId, waived: v === true });
              router.refresh();
            })
          }
        />
        Fee waived
      </label>
    </div>
  );
}

export function NoteForm({ school, applicationId }: { school: string; applicationId: string }) {
  const [state, formAction, pending] = useActionState<PipelineActionState, FormData>(
    addNote,
    undefined
  );

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="school" value={school} />
      <input type="hidden" name="applicationId" value={applicationId} />
      <Textarea name="body" rows={3} placeholder="Add an internal note (never visible to families)" required />
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Adding…" : "Add note"}
      </Button>
    </form>
  );
}

const DOC_BADGE: Record<string, "secondary" | "success" | "warning" | "destructive"> = {
  missing: "secondary",
  submitted: "warning",
  verified: "success",
  rejected: "destructive",
};

export function DocumentReviewList({
  school,
  documents,
}: {
  school: string;
  documents: {
    id: string;
    name: string;
    required: boolean;
    status: string;
    fileName: string | null;
    rejectionReason: string | null;
    uploadedAt: string | null;
  }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const view = (documentId: string) => {
    startTransition(async () => {
      const result = await getDocumentSignedUrl({ school, documentId });
      if (result?.url) window.open(result.url, "_blank", "noopener");
      else setError(result?.error ?? "Could not open the document");
    });
  };

  const review = (documentId: string, decision: "verified" | "rejected", r?: string) => {
    setError(null);
    startTransition(async () => {
      const result = await reviewDocument({ school, documentId, decision, reason: r });
      if (result?.error) {
        setError(result.error);
        return;
      }
      setRejecting(null);
      setReason("");
      router.refresh();
    });
  };

  if (documents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        The checklist appears once the family submits the application.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {documents.map((doc) => (
        <div key={doc.id} className="rounded-md border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">
                {doc.name}
                {doc.required && <span className="text-destructive"> *</span>}
              </p>
              {doc.fileName && <p className="text-xs text-muted-foreground">{doc.fileName}</p>}
              {doc.status === "rejected" && doc.rejectionReason && (
                <p className="text-xs text-destructive">Rejected: {doc.rejectionReason}</p>
              )}
            </div>
            <Badge variant={DOC_BADGE[doc.status] ?? "secondary"}>{doc.status}</Badge>
          </div>
          {doc.status !== "missing" && (
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={pending} onClick={() => view(doc.id)}>
                View
              </Button>
              {doc.status === "submitted" && (
                <>
                  <Button size="sm" disabled={pending} onClick={() => review(doc.id, "verified")}>
                    Verify
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={pending}
                    onClick={() => setRejecting(rejecting === doc.id ? null : doc.id)}
                  >
                    Reject
                  </Button>
                </>
              )}
            </div>
          )}
          {rejecting === doc.id && (
            <div className="mt-2 flex gap-2">
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason shown to the family"
              />
              <Button
                size="sm"
                variant="destructive"
                disabled={pending || !reason.trim()}
                onClick={() => review(doc.id, "rejected", reason)}
              >
                Confirm
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
