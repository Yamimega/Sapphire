"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ChevronLeft,
  ChevronRight,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Info,
  Download,
  Maximize2,
} from "lucide-react";
import type { PhotoWithUrls, ExifInfo } from "@/types";
import { useTranslation } from "@/lib/i18n/context";
import { useAuth } from "@/lib/auth-context";
import { BlobImage } from "@/components/blob-image";
import { ProtectedImage, xorDecrypt } from "@/components/protected-image";
import { cn } from "@/lib/utils";

interface PhotoLightboxProps {
  photos: PhotoWithUrls[];
  currentIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onIndexChange: (index: number) => void;
  allowDownload?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUploadDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ZOOM_LEVELS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
const MIN_ZOOM = ZOOM_LEVELS[0];
const MAX_ZOOM = ZOOM_LEVELS[ZOOM_LEVELS.length - 1];

function ToolbarButton({
  onClick,
  disabled,
  label,
  active,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-9 w-9 text-white/80 hover:text-white hover:bg-white/10 transition-colors",
            active && "bg-white/15 text-white"
          )}
          onClick={onClick}
          disabled={disabled}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="bg-neutral-800 text-white border-neutral-700">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function PhotoLightbox({
  photos,
  currentIndex,
  open,
  onOpenChange,
  onIndexChange,
  allowDownload,
}: PhotoLightboxProps) {
  const { t } = useTranslation();
  const { authenticated } = useAuth();
  const canDownload = authenticated || !!allowDownload;
  const photo = photos[currentIndex];
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showInfo, setShowInfo] = useState(false);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOffset = useRef({ x: 0, y: 0 });
  const filmstripRef = useRef<HTMLDivElement>(null);
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Reset zoom/pan when changing photos or closing
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [currentIndex, open]);

  // Auto-scroll filmstrip to current photo
  useEffect(() => {
    if (!filmstripRef.current) return;
    const thumb = filmstripRef.current.querySelector(`[data-index="${currentIndex}"]`);
    if (thumb) {
      thumb.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [currentIndex]);

  // Auto-hide toolbar after inactivity (throttled to avoid excessive state updates)
  useEffect(() => {
    if (!open) return;
    let lastMove = 0;
    const resetTimer = () => {
      const now = Date.now();
      if (now - lastMove < 200) return;
      lastMove = now;
      setToolbarVisible(true);
      clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setToolbarVisible(false), 3000);
    };
    resetTimer();
    window.addEventListener("mousemove", resetTimer);
    window.addEventListener("touchstart", resetTimer);
    return () => {
      clearTimeout(hideTimer.current);
      window.removeEventListener("mousemove", resetTimer);
      window.removeEventListener("touchstart", resetTimer);
    };
  }, [open]);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) onIndexChange(currentIndex - 1);
  }, [currentIndex, onIndexChange]);

  const goNext = useCallback(() => {
    if (currentIndex < photos.length - 1) onIndexChange(currentIndex + 1);
  }, [currentIndex, photos.length, onIndexChange]);

  const zoomIn = useCallback(() => {
    setZoom((z) => {
      const next = ZOOM_LEVELS.find((l) => l > z);
      return next ?? z;
    });
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((z) => {
      const next = [...ZOOM_LEVELS].reverse().find((l) => l < z);
      if (next && next <= 1) setPan({ x: 0, y: 0 });
      return next ?? z;
    });
  }, []);

  const zoomReset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const zoomFit = useCallback(() => {
    if (zoom === 1) {
      setZoom(2);
    } else {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  }, [zoom]);

  const handleDownload = useCallback(async () => {
    if (!photo || !canDownload) return;
    const downloadName = `${photo.filename}.jpg`;
    try {
      // Step 1: Get one-time download token
      const tokenRes = await fetch("/api/images/download-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId: photo.id, galleryId: photo.albumId }),
        credentials: "same-origin",
      });
      if (!tokenRes.ok) throw new Error("Failed to get download token");
      const { token } = await tokenRes.json();

      // Step 2: Fetch encrypted image via one-time token
      const res = await fetch(`/api/images/download/${token}`, { credentials: "same-origin" });
      if (!res.ok) throw new Error("Download failed");

      const keyBase64 = res.headers.get("X-Image-Key");
      if (!keyBase64) throw new Error("Missing key");

      const encrypted = new Uint8Array(await res.arrayBuffer());

      // Step 3: Decrypt XOR
      const decrypted = xorDecrypt(encrypted, keyBase64);

      // Step 4: Blob download
      const blob = new Blob([decrypted.buffer as ArrayBuffer], { type: "image/jpeg" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Silent fail — token expired or download not allowed
    }
  }, [photo, canDownload]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "+" || e.key === "=") zoomIn();
      else if (e.key === "-") zoomOut();
      else if (e.key === "0") zoomReset();
      else if (e.key === "i" || e.key === "I") setShowInfo((v) => !v);
      else if (e.key === "d" || e.key === "D") handleDownload();
      else if (e.key === "f" || e.key === "F") zoomFit();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, close, goPrev, goNext, zoomIn, zoomOut, zoomReset, zoomFit, handleDownload]);

  // Mouse wheel zoom — use callback ref to attach non-passive listener (React onWheel is passive)
  const zoomInRef = useRef(zoomIn);
  const zoomOutRef = useRef(zoomOut);
  zoomInRef.current = zoomIn;
  zoomOutRef.current = zoomOut;

  const wheelCleanup = useRef<(() => void) | null>(null);
  const wheelContainerRef = useCallback((el: HTMLDivElement | null) => {
    // Clean up previous listener
    wheelCleanup.current?.();
    wheelCleanup.current = null;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY < 0) zoomInRef.current();
      else zoomOutRef.current();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    wheelCleanup.current = () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Panning when zoomed
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (zoom <= 1) return;
      e.preventDefault();
      isPanning.current = true;
      panStart.current = { x: e.clientX, y: e.clientY };
      panOffset.current = { ...pan };
    },
    [zoom, pan]
  );

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    setPan({
      x: panOffset.current.x + (e.clientX - panStart.current.x),
      y: panOffset.current.y + (e.clientY - panStart.current.y),
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  // Double-click to toggle zoom
  const handleDoubleClick = useCallback(() => {
    if (zoom > 1) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    } else {
      setZoom(2);
    }
  }, [zoom]);

  // Touch swipe (only when not zoomed)
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (zoom > 1) return;
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    },
    [zoom]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (zoom > 1) return;
      if (touchStartX.current === null || touchStartY.current === null) return;
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      const dy = e.changedTouches[0].clientY - touchStartY.current;
      touchStartX.current = null;
      touchStartY.current = null;

      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx > 0) goPrev();
        else goNext();
      }
    },
    [zoom, goPrev, goNext]
  );

  // Prevent right-click for guests
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!authenticated) e.preventDefault();
    },
    [authenticated]
  );

  const exif = useMemo<ExifInfo | null>(() => {
    if (!photo?.exifData) return null;
    try {
      const parsed = JSON.parse(photo.exifData);
      return Object.keys(parsed).length > 0 ? parsed : null;
    } catch {
      return null;
    }
  }, [photo?.exifData]);

  if (!photo) return null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex flex-col outline-none"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onContextMenu={handleContextMenu}
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">
            {photo.filename}
          </DialogPrimitive.Title>

          <TooltipProvider delayDuration={300}>
            {/* Top toolbar */}
            <div
              className={cn(
                "absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-2 py-2 bg-gradient-to-b from-black/60 to-transparent transition-opacity duration-300",
                toolbarVisible ? "opacity-100" : "opacity-0 pointer-events-none"
              )}
            >
              {/* Left: zoom controls (hidden on mobile) */}
              <div className="hidden md:flex items-center gap-0.5">
                <ToolbarButton
                  onClick={zoomOut}
                  disabled={zoom <= MIN_ZOOM}
                  label={`${t("lightbox.zoomOut")} (−)`}
                >
                  <ZoomOut className="h-4 w-4" />
                </ToolbarButton>
                <button
                  onClick={zoomReset}
                  className="min-w-[3.5rem] rounded-md px-1.5 py-1 text-center text-xs font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <ToolbarButton
                  onClick={zoomIn}
                  disabled={zoom >= MAX_ZOOM}
                  label={`${t("lightbox.zoomIn")} (+)`}
                >
                  <ZoomIn className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton onClick={zoomFit} label="Fit / Fill (F)">
                  <Maximize2 className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton onClick={zoomReset} label={`${t("lightbox.zoomReset")} (0)`}>
                  <RotateCcw className="h-4 w-4" />
                </ToolbarButton>
              </div>

              {/* Left on mobile: counter */}
              <div className="md:hidden text-sm font-medium text-white/70">
                {currentIndex + 1} / {photos.length}
              </div>

              {/* Center: counter (desktop only) */}
              <div className="hidden md:block absolute left-1/2 -translate-x-1/2 text-sm font-medium text-white/70">
                {currentIndex + 1} / {photos.length}
              </div>

              {/* Right: actions */}
              <div className="flex items-center gap-0.5">
                <ToolbarButton
                  onClick={() => setShowInfo(!showInfo)}
                  active={showInfo}
                  label={`${t("lightbox.info")} (I)`}
                >
                  <Info className="h-4 w-4" />
                </ToolbarButton>
                {canDownload && (
                  <ToolbarButton onClick={handleDownload} label={`${t("lightbox.download")} (D)`}>
                    <Download className="h-4 w-4" />
                  </ToolbarButton>
                )}
                <ToolbarButton onClick={close} label={`${t("lightbox.close")} (Esc)`}>
                  <X className="h-5 w-5" />
                </ToolbarButton>
              </div>
            </div>

            {/* Main image area */}
            <div className="relative flex flex-1 items-center justify-center overflow-hidden">
              {/* Prev button (hidden on mobile — use swipe) */}
              {currentIndex > 0 && (
                <button
                  className={cn(
                    "absolute left-2 z-20 hidden md:flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white/80 backdrop-blur-sm transition-all hover:bg-black/60 hover:text-white hover:scale-110 lg:h-12 lg:w-12",
                    toolbarVisible ? "opacity-100" : "opacity-0 pointer-events-none",
                    "transition-opacity duration-300"
                  )}
                  onClick={goPrev}
                  aria-label={t("lightbox.prev")}
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
              )}

              {/* Image */}
              <div
                ref={wheelContainerRef}
                className={cn(
                  "flex items-center justify-center w-full h-full",
                  zoom > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-default"
                )}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onDoubleClick={handleDoubleClick}
              >
                {!canDownload ? (
                  <ProtectedImage
                    src={photo.url}
                    alt={photo.filename}
                    tiled
                    imageWidth={photo.width}
                    imageHeight={photo.height}
                    className="max-h-[calc(100vh-4rem)] max-w-[calc(100vw-1rem)] md:max-h-[calc(100vh-8rem)] md:max-w-[calc(100vw-2rem)] h-auto w-auto select-none transition-transform duration-150 ease-out"
                    style={{
                      transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                    }}
                  />
                ) : (
                  <BlobImage
                    src={photo.url}
                    alt={photo.filename}
                    className="max-h-[calc(100vh-4rem)] max-w-[calc(100vw-1rem)] md:max-h-[calc(100vh-8rem)] md:max-w-[calc(100vw-2rem)] select-none object-contain transition-transform duration-150 ease-out"
                    style={{
                      transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                    }}
                  />
                )}
              </div>

              {/* Next button (hidden on mobile — use swipe) */}
              {currentIndex < photos.length - 1 && (
                <button
                  className={cn(
                    "absolute right-2 z-20 hidden md:flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white/80 backdrop-blur-sm transition-all hover:bg-black/60 hover:text-white hover:scale-110 lg:h-12 lg:w-12",
                    toolbarVisible ? "opacity-100" : "opacity-0 pointer-events-none",
                    "transition-opacity duration-300"
                  )}
                  onClick={goNext}
                  aria-label={t("lightbox.next")}
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              )}
            </div>

            {/* Bottom: caption + filmstrip */}
            <div
              className={cn(
                "absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black/70 to-transparent pt-8 pb-3 transition-opacity duration-300",
                toolbarVisible ? "opacity-100" : "opacity-0 pointer-events-none"
              )}
            >
              {/* Caption */}
              {photo.caption && (
                <p className="mb-2 text-center text-sm text-white/90 px-4 max-w-2xl mx-auto">
                  {photo.caption}
                </p>
              )}

              {/* Filmstrip (hidden on small phones, compact on tablet) */}
              {photos.length > 1 && (
                <div className="hidden sm:flex justify-center px-4">
                  <div
                    ref={filmstripRef}
                    className="flex gap-1 md:gap-1.5 overflow-x-auto py-1 px-1 max-w-[min(100vw-2rem,600px)] scrollbar-none"
                    style={{ scrollbarWidth: "none" }}
                  >
                    {photos.map((p, i) => (
                      <button
                        key={p.id}
                        data-index={i}
                        className={cn(
                          "shrink-0 h-9 w-9 md:h-12 md:w-12 rounded-md overflow-hidden border-2 transition-all duration-150",
                          i === currentIndex
                            ? "border-white ring-1 ring-white/50 scale-110"
                            : "border-transparent opacity-50 hover:opacity-80 hover:border-white/30"
                        )}
                        onClick={() => onIndexChange(i)}
                      >
                        {!canDownload ? (
                          <ProtectedImage
                            src={p.thumbnailUrl}
                            alt=""
                            className="h-full w-full"
                          />
                        ) : (
                          <BlobImage
                            src={p.thumbnailUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Info panel (slide from right) */}
            <div
              className={cn(
                "absolute top-0 right-0 bottom-0 z-40 w-80 border-l border-white/10 bg-black/90 backdrop-blur-md transition-transform duration-300 ease-out",
                showInfo ? "translate-x-0" : "translate-x-full"
              )}
            >
              <div className="flex h-full flex-col">
                {/* Info header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                  <h3 className="text-sm font-semibold text-white">{t("lightbox.info")}</h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-white/60 hover:text-white hover:bg-white/10"
                    onClick={() => setShowInfo(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Info content */}
                <ScrollArea className="flex-1">
                  <div className="p-4 space-y-4">
                    {/* Caption */}
                    {photo.caption && (
                      <>
                        <div>
                          <dt className="text-xs font-medium text-white/40 uppercase tracking-wider">
                            {t("lightbox.caption")}
                          </dt>
                          <dd className="mt-1 text-sm text-white/80">{photo.caption}</dd>
                        </div>
                        <Separator className="bg-white/10" />
                      </>
                    )}

                    {/* File info */}
                    <div className="space-y-3">
                      <InfoRow label={t("lightbox.filename")} value={photo.filename} breakAll />
                      <InfoRow
                        label={t("lightbox.dimensions")}
                        value={`${photo.width} × ${photo.height}`}
                      />
                      <InfoRow label={t("lightbox.fileSize")} value={formatBytes(photo.fileSize)} />
                      <InfoRow label={t("lightbox.type")} value={photo.mimeType} />
                      <InfoRow
                        label={t("lightbox.uploaded")}
                        value={formatUploadDate(photo.uploadedAt)}
                      />
                    </div>

                    {/* EXIF Data */}
                    {exif && (
                      <>
                        <Separator className="bg-white/10" />
                        <div>
                          <h4 className="mb-3 text-xs font-semibold text-white/60 uppercase tracking-wider">
                            {t("lightbox.exif")}
                          </h4>
                          <div className="space-y-3">
                            {(exif.cameraMake || exif.cameraModel) && (
                              <InfoRow
                                label={t("lightbox.camera")}
                                value={[exif.cameraMake, exif.cameraModel]
                                  .filter(Boolean)
                                  .join(" ")}
                              />
                            )}
                            {exif.lens && (
                              <InfoRow label={t("lightbox.lens")} value={exif.lens} />
                            )}
                            {(exif.focalLength ||
                              exif.aperture ||
                              exif.shutterSpeed ||
                              exif.iso) && (
                              <div className="grid grid-cols-2 gap-3">
                                {exif.focalLength && (
                                  <InfoRow
                                    label={t("lightbox.focalLength")}
                                    value={exif.focalLength}
                                  />
                                )}
                                {exif.aperture && (
                                  <InfoRow label={t("lightbox.aperture")} value={exif.aperture} />
                                )}
                                {exif.shutterSpeed && (
                                  <InfoRow
                                    label={t("lightbox.shutterSpeed")}
                                    value={exif.shutterSpeed}
                                  />
                                )}
                                {exif.iso && (
                                  <InfoRow
                                    label={t("lightbox.iso")}
                                    value={String(exif.iso)}
                                  />
                                )}
                              </div>
                            )}
                            {exif.dateTaken && (
                              <InfoRow
                                label={t("lightbox.dateTaken")}
                                value={formatUploadDate(exif.dateTaken)}
                              />
                            )}
                            {exif.gpsLatitude != null && exif.gpsLongitude != null && (
                              <InfoRow
                                label={t("lightbox.gps")}
                                value={`${exif.gpsLatitude.toFixed(6)}, ${exif.gpsLongitude.toFixed(6)}`}
                              />
                            )}
                            {exif.software && (
                              <InfoRow label={t("lightbox.software")} value={exif.software} />
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </TooltipProvider>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function InfoRow({
  label,
  value,
  breakAll,
}: {
  label: string;
  value: string;
  breakAll?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-white/40 uppercase tracking-wider">{label}</dt>
      <dd className={cn("mt-0.5 text-sm text-white/80", breakAll && "break-all")}>{value}</dd>
    </div>
  );
}
