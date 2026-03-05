import path from "path";

export const DATA_DIR = path.join(process.cwd(), "data");
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
export const ORIGINALS_DIR = path.join(UPLOADS_DIR, "originals");
export const THUMBNAILS_DIR = path.join(UPLOADS_DIR, "thumbnails");
export const COVERS_DIR = path.join(UPLOADS_DIR, "covers");

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const THUMBNAIL_WIDTH = 400;

export const ACCEPTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export type AcceptedMimeType = (typeof ACCEPTED_MIME_TYPES)[number];

export const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export const EXT_TO_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
};

export const UPLOAD_SUBDIRS = ["originals", "thumbnails", "covers", "favicon"] as const;

export const MAX_TIMELINE_THUMBNAILS = 3;
