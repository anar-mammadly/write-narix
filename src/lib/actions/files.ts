"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ORDER_FILES_BUCKET } from "@/lib/storage";
import type { FileCategory } from "@/lib/supabase/database.types";

export async function recordFileUploadAction(input: {
  orderId: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  category: FileCategory;
  orderRequestId?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();

  const { error } = await supabase.from("files").insert({
    order_id: input.orderId,
    uploaded_by: userData.user?.id ?? null,
    category: input.category,
    storage_path: input.storagePath,
    file_name: input.fileName,
    mime_type: input.mimeType,
    size_bytes: input.sizeBytes,
    order_request_id: input.orderRequestId ?? null,
  });

  if (error) return { ok: false, error: "Could not save this file to the order." };
  return { ok: true };
}

// Files are only ever served through a short-lived signed URL — RLS on
// storage.objects still governs whether this succeeds for the caller.
export async function createSignedDownloadUrlAction(storagePath: string): Promise<string | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.storage
    .from(ORDER_FILES_BUCKET)
    .createSignedUrl(storagePath, 60 * 5);

  if (error) return null;
  return data.signedUrl;
}
