"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { attachDocument, getDocumentSignedUrl } from "@/lib/documents/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const STATUS_BADGE: Record<string, "secondary" | "success" | "warning" | "destructive"> = {
  missing: "secondary",
  submitted: "warning",
  verified: "success",
  rejected: "destructive",
};

const STATUS_LABEL: Record<string, string> = {
  missing: "Needed",
  submitted: "Submitted — awaiting review",
  verified: "Verified",
  rejected: "Needs a new upload",
};

export interface ChecklistDocument {
  id: string;
  name: string;
  description: string | null;
  required: boolean;
  status: string;
  fileName: string | null;
  rejectionReason: string | null;
}

export function DocumentChecklist({
  school,
  tenantId,
  applicationId,
  documents,
}: {
  school: string;
  tenantId: string;
  applicationId: string;
  documents: ChecklistDocument[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const upload = (doc: ChecklistDocument, file: File) => {
    setError(null);
    setUploadingId(doc.id);
    startTransition(async () => {
      try {
        const supabase = createClient();
        // Opaque path — no student names in storage keys.
        const path = `${tenantId}/${applicationId}/${doc.id}`;
        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(path, file, { upsert: true, contentType: file.type });
        if (uploadError) {
          setError(`Upload failed: ${uploadError.message}`);
          return;
        }
        const result = await attachDocument({
          school,
          documentId: doc.id,
          storagePath: path,
          fileName: file.name,
        });
        if (result?.error) {
          setError(result.error);
          return;
        }
        router.refresh();
      } finally {
        setUploadingId(null);
      }
    });
  };

  const view = (documentId: string) => {
    startTransition(async () => {
      const result = await getDocumentSignedUrl({ school, documentId });
      if (result?.url) window.open(result.url, "_blank", "noopener");
      else setError(result?.error ?? "Could not open the document");
    });
  };

  if (documents.length === 0) return null;

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Document checklist</h2>
        <p className="text-sm text-muted-foreground">
          Upload a photo or PDF of each item (10 MB max). The school will verify each one.
        </p>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {documents.map((doc) => (
        <div key={doc.id} className="rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-medium">
                {doc.name}
                {doc.required && <span className="text-destructive"> *</span>}
              </p>
              {doc.description && (
                <p className="text-sm text-muted-foreground">{doc.description}</p>
              )}
              {doc.fileName && <p className="text-xs text-muted-foreground">{doc.fileName}</p>}
              {doc.status === "rejected" && doc.rejectionReason && (
                <p className="text-sm text-destructive">{doc.rejectionReason}</p>
              )}
            </div>
            <Badge variant={STATUS_BADGE[doc.status] ?? "secondary"}>
              {STATUS_LABEL[doc.status] ?? doc.status}
            </Badge>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              ref={(el) => {
                if (el) inputRefs.current.set(doc.id, el);
              }}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/heic,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload(doc, file);
                e.target.value = "";
              }}
            />
            {doc.status !== "verified" && (
              <Button
                size="sm"
                variant={doc.status === "missing" || doc.status === "rejected" ? "default" : "outline"}
                disabled={pending}
                onClick={() => inputRefs.current.get(doc.id)?.click()}
              >
                {uploadingId === doc.id
                  ? "Uploading…"
                  : doc.status === "missing"
                    ? "Upload"
                    : "Replace"}
              </Button>
            )}
            {doc.status !== "missing" && (
              <Button size="sm" variant="outline" disabled={pending} onClick={() => view(doc.id)}>
                View
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
