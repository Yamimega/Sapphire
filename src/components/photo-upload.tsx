"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/context";
import { toast } from "sonner";

interface PhotoUploadProps {
  albumId: string;
  onUploadComplete: () => void;
}

interface PendingFile {
  file: File;
  preview: string;
}

export function PhotoUpload({ albumId, onUploadComplete }: PhotoUploadProps) {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((files: FileList | File[]) => {
    const newPending: PendingFile[] = [];
    for (const file of Array.from(files)) {
      if (
        file.type === "image/jpeg" ||
        file.type === "image/png" ||
        file.type === "image/webp" ||
        file.type === "image/gif"
      ) {
        newPending.push({ file, preview: URL.createObjectURL(file) });
      }
    }
    setPendingFiles((prev) => [...prev, ...newPending]);
  }, []);

  const removeFile = useCallback((index: number) => {
    setPendingFiles((prev) => {
      const removed = prev[index];
      if (removed) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const clearAll = useCallback(() => {
    pendingFiles.forEach((f) => URL.revokeObjectURL(f.preview));
    setPendingFiles([]);
  }, [pendingFiles]);

  const uploadFiles = useCallback(async () => {
    if (pendingFiles.length === 0) return;
    setIsUploading(true);
    const total = pendingFiles.length;
    setUploadProgress({ current: 0, total });

    let uploaded = 0;
    let failed = 0;

    // Upload individual files with concurrency limit of 3
    const concurrency = 3;
    const queue = [...pendingFiles];

    const worker = async () => {
      while (queue.length > 0) {
        const pf = queue.shift();
        if (!pf) break;
        const formData = new FormData();
        formData.append("files", pf.file);

        try {
          const res = await fetch(`/api/gallery/${albumId}/photos`, {
            method: "POST",
            body: formData,
          });
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "Upload failed");
          }
        } catch {
          failed++;
        }
        uploaded++;
        setUploadProgress({ current: uploaded, total });
      }
    };

    await Promise.all(Array.from({ length: concurrency }, () => worker()));

    if (failed > 0) {
      toast.error(t("upload.partialFail", { failed }));
    } else {
      toast.success(t("upload.success", { count: total }));
    }
    clearAll();
    onUploadComplete();
    setIsUploading(false);
    setUploadProgress({ current: 0, total: 0 });
  }, [pendingFiles, albumId, onUploadComplete, clearAll, t]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-all duration-200 md:p-8",
          isDragging ? "border-primary bg-primary/5 scale-[1.01] shadow-inner" : "border-muted-foreground/25 hover:border-muted-foreground/40",
          isUploading && "pointer-events-none opacity-60"
        )}
      >
        <Upload className={cn("mb-3 h-8 w-8 transition-colors", isDragging ? "text-primary" : "text-muted-foreground")} />
        {isUploading ? (
          <div className="mb-3 w-full max-w-xs space-y-2">
            <p className="text-center text-sm font-medium">
              {t("upload.progress", {
                current: uploadProgress.current,
                total: uploadProgress.total,
              })}
            </p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${uploadProgress.total > 0 ? (uploadProgress.current / uploadProgress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        ) : (
          <p className="mb-3 text-center text-sm text-muted-foreground">
            {t("upload.prompt")}
          </p>
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={isUploading}
          onClick={() => inputRef.current?.click()}
          className="touch-manipulation"
        >
          {t("upload.browse")}
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* Preview grid */}
      {pendingFiles.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">
              {t("upload.selected", { count: pendingFiles.length })}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={clearAll}
                disabled={isUploading}
              >
                {t("upload.clear")}
              </Button>
              <Button size="sm" onClick={uploadFiles} disabled={isUploading}>
                <Upload className="mr-2 h-4 w-4" />
                {isUploading
                  ? t("upload.progress", {
                      current: uploadProgress.current,
                      total: uploadProgress.total,
                    })
                  : t("upload.uploadBtn")}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
            {pendingFiles.map((pf, i) => (
              <div key={i} className="group relative aspect-square overflow-hidden rounded-md bg-muted">
                <img
                  src={pf.preview}
                  alt={pf.file.name}
                  className="h-full w-full object-cover"
                />
                {!isUploading && (
                  <button
                    onClick={() => removeFile(i)}
                    className="absolute top-0.5 right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 max-md:opacity-100"
                    aria-label="Remove"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
                <div className="absolute bottom-0 left-0 right-0 truncate bg-black/50 px-1 py-0.5 text-[10px] text-white">
                  {pf.file.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
