"use client";

import { useTransition } from "react";
import { FileText, Download } from "lucide-react";
import { createSignedDownloadUrlAction } from "@/lib/actions/files";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FileRow = { id: string; file_name: string; category: string; storage_path: string; size_bytes: number; created_at: string };

export function FileList({
  files,
  className,
  emptyLabel = "No files yet.",
}: {
  files: FileRow[];
  className?: string;
  emptyLabel?: string;
}) {
  const [pending, startTransition] = useTransition();

  function handleDownload(path: string) {
    startTransition(async () => {
      const url = await createSignedDownloadUrlAction(path);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    });
  }

  if (files.length === 0) {
    return <p className={cn("text-sm text-muted-foreground", className)}>{emptyLabel}</p>;
  }

  return (
    <ul className={cn("divide-y divide-border rounded-lg border border-border", className)}>
      {files.map((file) => (
        <li key={file.id} className="flex items-center justify-between px-4 py-3 text-sm">
          <span className="flex items-center gap-2.5">
            <FileText className="size-4 text-muted-foreground" />
            <span>
              {file.file_name}
              <span className="ml-2 text-xs text-muted-foreground">{(file.size_bytes / 1024).toFixed(0)} KB</span>
            </span>
          </span>
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => handleDownload(file.storage_path)}>
            <Download className="size-4" />
          </Button>
        </li>
      ))}
    </ul>
  );
}
