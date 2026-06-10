"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getTenantBySlug, requireStaff, requireUser } from "@/lib/tenant";

export type DocActionState = { error?: string; ok?: boolean; url?: string } | undefined;

const attachSchema = z.object({
  school: z.string().min(1),
  documentId: z.string().uuid(),
  storagePath: z.string().min(1),
  fileName: z.string().min(1).max(255),
});

/** Called after the browser uploads the file to Storage (RLS-gated). */
export async function attachDocument(input: {
  school: string;
  documentId: string;
  storagePath: string;
  fileName: string;
}): Promise<DocActionState> {
  const parsed = attachSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  const tenant = await getTenantBySlug(parsed.data.school);
  const user = await requireUser();
  const supabase = await createClient();

  // The path must follow <tenant>/<application>/<doc> and match this row.
  const { data: doc } = await supabase
    .from("application_documents")
    .select("id, application_id, tenant_id")
    .eq("id", parsed.data.documentId)
    .maybeSingle<{ id: string; application_id: string; tenant_id: string }>();
  if (!doc || doc.tenant_id !== tenant.id) return { error: "Document not found" };

  const expectedPrefix = `${tenant.id}/${doc.application_id}/`;
  if (!parsed.data.storagePath.startsWith(expectedPrefix)) {
    return { error: "Invalid upload path" };
  }

  const { error } = await supabase
    .from("application_documents")
    .update({
      storage_path: parsed.data.storagePath,
      file_name: parsed.data.fileName,
      status: "submitted",
      rejection_reason: null,
      uploaded_by: user.id,
      uploaded_at: new Date().toISOString(),
    })
    .eq("id", doc.id);

  if (error) return { error: "Could not record the upload" };

  await supabase.rpc("log_audit", {
    p_tenant_id: tenant.id,
    p_entity_type: "document",
    p_entity_id: doc.id,
    p_action: "uploaded",
    p_after: { status: "submitted" },
  });

  revalidatePath(`/s/${parsed.data.school}/portal/applications/${doc.application_id}`);
  return { ok: true };
}

/** Short-lived signed URL for viewing a document. RLS on the row gates access. */
export async function getDocumentSignedUrl(input: {
  school: string;
  documentId: string;
}): Promise<DocActionState> {
  const parsed = z
    .object({ school: z.string().min(1), documentId: z.string().uuid() })
    .safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  await requireUser();
  const supabase = await createClient();

  const { data: doc } = await supabase
    .from("application_documents")
    .select("storage_path")
    .eq("id", parsed.data.documentId)
    .maybeSingle<{ storage_path: string | null }>();

  if (!doc?.storage_path) return { error: "No file uploaded yet" };

  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(doc.storage_path, 60);

  if (error || !data) return { error: "Could not generate a link" };
  return { ok: true, url: data.signedUrl };
}

const reviewSchema = z.object({
  school: z.string().min(1),
  documentId: z.string().uuid(),
  decision: z.enum(["verified", "rejected"]),
  reason: z.string().max(500).optional(),
});

export async function reviewDocument(input: {
  school: string;
  documentId: string;
  decision: "verified" | "rejected";
  reason?: string;
}): Promise<DocActionState> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };
  if (parsed.data.decision === "rejected" && !parsed.data.reason?.trim()) {
    return { error: "A reason is required when rejecting a document" };
  }

  const { tenant, user } = await requireStaff(parsed.data.school);
  const supabase = await createClient();

  const { data: doc } = await supabase
    .from("application_documents")
    .select("id, status, application_id")
    .eq("id", parsed.data.documentId)
    .eq("tenant_id", tenant.id)
    .maybeSingle<{ id: string; status: string; application_id: string }>();
  if (!doc) return { error: "Document not found" };

  const { error } = await supabase
    .from("application_documents")
    .update({
      status: parsed.data.decision,
      rejection_reason: parsed.data.decision === "rejected" ? parsed.data.reason!.trim() : null,
      verified_by: user.id,
      verified_at: new Date().toISOString(),
    })
    .eq("id", doc.id);

  if (error) return { error: "Could not update the document" };

  await supabase.rpc("log_audit", {
    p_tenant_id: tenant.id,
    p_entity_type: "document",
    p_entity_id: doc.id,
    p_action: `document_${parsed.data.decision}`,
    p_before: { status: doc.status },
    p_after: { status: parsed.data.decision, reason: parsed.data.reason ?? null },
  });

  revalidatePath(`/s/${parsed.data.school}/admin/applications/${doc.application_id}`);
  return { ok: true };
}
