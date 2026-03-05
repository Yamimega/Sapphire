"use client";

import { useEffect, useRef, useState } from "react";

const blobCache = new Map<string, string>();

interface BlobImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
}

export function BlobImage({ src, alt, className, style, ...props }: BlobImageProps) {
  const [blobUrl, setBlobUrl] = useState<string>(() => blobCache.get(src) ?? "");
  const [error, setError] = useState(false);
  const [visible, setVisible] = useState(() => !!blobCache.get(src));
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Lazy: observe visibility before fetching
  useEffect(() => {
    if (blobCache.get(src)) {
      setVisible(true);
      return;
    }
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [src]);

  // Fetch once visible
  useEffect(() => {
    if (!src || !visible) return;

    const cached = blobCache.get(src);
    if (cached) {
      setBlobUrl(cached);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    fetch(src, { signal: controller.signal, credentials: "same-origin" })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch image");
        return res.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        blobCache.set(src, url);
        setBlobUrl(url);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(true);
      });

    return () => {
      controller.abort();
    };
  }, [src, visible]);

  if (error || !blobUrl) {
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
