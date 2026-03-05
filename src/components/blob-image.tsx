"use client";

import { useEffect, useRef, useState } from "react";

const blobCache = new Map<string, string>();

interface BlobImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
}

export function BlobImage({ src, alt, className, style, ...props }: BlobImageProps) {
  const [blobUrl, setBlobUrl] = useState<string>(() => blobCache.get(src) ?? "");
  const [error, setError] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!src) return;

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
  }, [src]);

  if (error || !blobUrl) {
    return (
      <div className={className} style={{ ...style, display: "flex", alignItems: "center", justifyContent: "center" }}>
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
