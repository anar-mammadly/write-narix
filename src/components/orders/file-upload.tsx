"use client";

import { useRef, useState } from "react";
import { UploadCloud, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { recordFileUploadAction } from "@/lib/actions/files";
import { buildStoragePath, ORDER_FILES_BUCKET } from "@/lib/storage";
import type { FileCategory } from "@/lib/supabase/database.types";
import { Button } from "@/components/ui/button";

const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4MB — matches the order-files bucket's file_size_limit

const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/csv",
];

const ACCEPTED_EXTENSIONS = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.csv";

export function FileUpload({
  orderId,
  category,
  orderRequestId,
  onUploaded,
  label = "Upload file",
  uploadingLabel = "Uploading…",
}: {
  orderId: string;
  category: FileCategory;
  orderRequestId?: string | null;
  onUploaded?: () => void;
  label?: string;
  uploadingLabel?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);

    if (file.size > MAX_FILE_BYTES) {
      setError("File is too large — max 4MB.");
      return;
    }
    if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
      setError("Unsupported file type. Allowed: PDF, Word, Excel, PowerPoint, images, CSV.");
      return;
    }

    setUploading(true);

    const supabase = createClient();
    const path = buildStoragePath(orderId, category, file.name);

    const { error: uploadError } = await supabase.storage.from(ORDER_FILES_BUCKET).upload(path, file);
    if (uploadError) {
      setError("Upload failed. Check the file type and size (max 4MB) and try again.");
      setUploading(false);
      return;
    }

    const result = await recordFileUploadAction({
      orderId,
      storagePath: path,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      category,
      orderRequestId,
    });

    setUploading(false);
    if (!result.ok) {
      setError(result.error ?? "Something went wrong.");
      return;
    }
    onUploaded?.();
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
        {uploading ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
        {uploading ? uploadingLabel : label}
      </Button>
      {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
    </div>
  );
}
