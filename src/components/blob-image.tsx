"use client";

import { useEffect, useRef, useState } from "react";

const CACHE_MAX = 200;
const blobCache = new Map<string, string>();

function evictOldest() {
  if (blobCache.size <= CACHE_MAX) return;
  const first = blobCache.keys().next().value;
  if (first) {
    URL.revokeObjectURL(blobCache.get(first)!);
    blobCache.delete(first);
  }
}

interface BlobImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
}

export function BlobImage({ src, alt, className, style, ...props }: BlobImageProps) {
  const [blobUrl, setBlobUrl] = useState<string>(() => blobCache.get(src) ?? "");
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // When src changes, immediately show cached blob or reset to placeholder
  useEffect(() => {
    setBlobUrl(blobCache.get(src) ?? "");
  }, [src]);

  useEffect(() => {
    if (!src || blobCache.has(src)) return;

    // Wait until near viewport before fetching
    const el = containerRef.current;
    if (!el) return;

    let cancelled = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();

        const controller = new AbortController();
        abortRef.current = controller;

        fetch(src, { signal: controller.signal, credentials: "same-origin" })
          .then((res) => {
            if (!res.ok) throw new Error("Failed to fetch image");
            return res.blob();
          })
          .then((blob) => {
            if (cancelled) return;
            const url = URL.createObjectURL(blob);
            blobCache.set(src, url);
            evictOldest();
            setBlobUrl(url);
          })
          .catch(() => {});
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);

    return () => {
      cancelled = true;
      observer.disconnect();
      abortRef.current?.abort();
    };
  }, [src]);

  if (!blobUrl) {
    return (
      <div ref={containerRef} className={className} style={{ ...style, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="h-full w-full animate-pulse bg-muted" />
      </div>
    );
  }

  return (
    <img
      src={blobUrl}
      alt={alt}
      className={className}
      style={style}
      draggable={false}
      {...props}
    />
  );
}
