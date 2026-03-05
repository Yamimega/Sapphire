"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

const TILE_GRID = 3; // 3x3 = 9 tiles for full-size images

interface ProtectedImageProps {
  src: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  /** Use tile/fragment delivery (for full-size lightbox images) */
  tiled?: boolean;
  /** Known image dimensions (required for tiled mode) */
  imageWidth?: number;
  imageHeight?: number;
}

/** XOR decrypt a Uint8Array with a base64-encoded key */
export function xorDecrypt(data: Uint8Array, keyBase64: string): Uint8Array {
  const keyStr = atob(keyBase64);
  const key = new Uint8Array(keyStr.length);
  for (let i = 0; i < keyStr.length; i++) {
    key[i] = keyStr.charCodeAt(i);
  }
  const result = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ key[i % key.length];
  }
  return result;
}

/** Fetch a single image (possibly encrypted), return ImageBitmap */
async function fetchProtectedImage(url: string, signal?: AbortSignal): Promise<ImageBitmap> {
  const res = await fetch(url, { credentials: "same-origin", signal });
  if (!res.ok) throw new Error("Failed to fetch image");

  const isProtected = res.headers.get("X-Protected") === "1";

  if (isProtected) {
    const keyBase64 = res.headers.get("X-Image-Key");
    if (!keyBase64) throw new Error("Missing encryption key");
    const encrypted = new Uint8Array(await res.arrayBuffer());
    const decrypted = xorDecrypt(encrypted, keyBase64);
    const blob = new Blob([decrypted.buffer as ArrayBuffer], { type: "image/jpeg" });
    return createImageBitmap(blob);
  }

  // Non-protected fallback
  const blob = await res.blob();
  return createImageBitmap(blob);
}

/**
 * Canvas-based image component for protected (non-downloadable) galleries.
 *
 * Protection layers:
 * 1. Canvas rendering — no right-click "Save Image As", no drag-to-desktop
 * 2. Server-side watermarking — visible watermark baked into pixel data
 * 3. Encrypted delivery — XOR-encrypted bytes, decoded client-side
 * 4. Tile/fragment delivery — full-size images split into NxN grid tiles
 */
export function ProtectedImage({
  src,
  alt,
  className,
  style,
  tiled = false,
  imageWidth,
  imageHeight,
}: ProtectedImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Override toDataURL/toBlob on the canvas to prevent extraction
  const lockCanvas = useCallback((canvas: HTMLCanvasElement) => {
    canvas.toDataURL = () => "";
    canvas.toBlob = () => {};
  }, []);

  useEffect(() => {
    if (!src) return;
    const controller = new AbortController();

    if (tiled && imageWidth && imageHeight) {
      loadTiled(controller.signal);
    } else {
      loadSingle(controller.signal);
    }

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, tiled, imageWidth, imageHeight]);

  async function loadSingle(signal: AbortSignal) {
    try {
      const bitmap = await fetchProtectedImage(src, signal);
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container || signal.aborted) return;

      lockCanvas(canvas);

      // Use container dimensions for "cover" rendering
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      const ctx = canvas.getContext("2d")!;
      ctx.scale(dpr, dpr);
      drawCover(ctx, bitmap, rect.width, rect.height);
      bitmap.close();
      setLoading(false);
    } catch (err) {
      if ((err as Error).name !== "AbortError") setError(true);
    }
  }

  async function loadTiled(signal: AbortSignal) {
    if (!imageWidth || !imageHeight) return;

    try {
      const canvas = canvasRef.current;
      if (!canvas) return;

      lockCanvas(canvas);

      // Set canvas to full image size
      canvas.width = imageWidth;
      canvas.height = imageHeight;
      const ctx = canvas.getContext("2d")!;

      const tileW = Math.ceil(imageWidth / TILE_GRID);
      const tileH = Math.ceil(imageHeight / TILE_GRID);

      // Build tile URLs
      const tiles: { row: number; col: number; url: string }[] = [];
      for (let r = 0; r < TILE_GRID; r++) {
        for (let c = 0; c < TILE_GRID; c++) {
          const sep = src.includes("?") ? "&" : "?";
          tiles.push({
            row: r,
            col: c,
            url: `${src}${sep}tile=${r},${c}&grid=${TILE_GRID},${TILE_GRID}`,
          });
        }
      }

      // Fetch all tiles in parallel
      const results = await Promise.allSettled(
        tiles.map(async (tile) => {
          const bitmap = await fetchProtectedImage(tile.url, signal);
          return { ...tile, bitmap };
        })
      );

      if (signal.aborted) return;

      // Draw each tile at its position
      for (const result of results) {
        if (result.status === "fulfilled") {
          const { row, col, bitmap } = result.value;
          ctx.drawImage(bitmap, col * tileW, row * tileH);
          bitmap.close();
        }
      }

      setLoading(false);
    } catch (err) {
      if ((err as Error).name !== "AbortError") setError(true);
    }
  }

  const preventInteraction = useCallback((e: React.MouseEvent | React.DragEvent) => {
    e.preventDefault();
  }, []);

  if (error) {
    return (
      <div
        className={className}
        style={{ ...style, display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <div className="h-full w-full bg-muted" />
      </div>
    );
  }

  // Tiled mode (lightbox): canvas maintains its natural aspect ratio via CSS
  if (tiled) {
    return (
      <>
        {loading && (
          <div className={className} style={style}>
            <div className="h-full w-full animate-pulse bg-muted/30 rounded" />
          </div>
        )}
        <canvas
          ref={canvasRef}
          className={cn(className, loading && "hidden")}
          style={style}
          onContextMenu={preventInteraction}
          onDragStart={preventInteraction}
          aria-label={alt}
        />
      </>
    );
  }

  // Single mode (thumbnails): canvas fills container with "cover" behavior
  return (
    <div
      ref={containerRef}
      className={cn("relative", className)}
      style={style}
      onContextMenu={preventInteraction}
      onDragStart={preventInteraction}
    >
      {loading && <div className="absolute inset-0 animate-pulse bg-muted" />}
      <canvas
        ref={canvasRef}
        className={cn("h-full w-full", loading && "invisible")}
        aria-label={alt}
      />
    </div>
  );
}

/** Draw image to fill canvas (crop to cover) */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: ImageBitmap,
  displayW: number,
  displayH: number
) {
  const scale = Math.max(displayW / img.width, displayH / img.height);
  const sw = displayW / scale;
  const sh = displayH / scale;
  const sx = (img.width - sw) / 2;
  const sy = (img.height - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, displayW * (window.devicePixelRatio || 1), displayH * (window.devicePixelRatio || 1));
}
