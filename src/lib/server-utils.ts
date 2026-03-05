import crypto from "crypto";
import fs from "fs";
import path from "path";
import { ACCEPTED_MIME_TYPES, ORIGINALS_DIR, THUMBNAILS_DIR } from "./constants";

export function generateId(): string {
  return crypto.randomUUID();
}

/** Generate an 8-character alphanumeric short ID for albums */
export function generateShortId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.randomBytes(8);
  return Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join("");
}

export function formatDate(date: Date = new Date()): string {
  return date.toISOString().split("T")[0];
}

export function formatDatetime(date: Date = new Date()): string {
  return date.toISOString();
}

export function isAcceptedMimeType(mime: string): boolean {
  return (ACCEPTED_MIME_TYPES as readonly string[]).includes(mime);
}

export function sha256(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/** Simple hash for album passwords (using HMAC with a static salt) */
export function hashAlbumPassword(password: string): string {
  return crypto.createHash("sha256").update(`sapphire-album:${password}`).digest("hex");
}

/** XOR encrypt/decrypt a buffer with a key (symmetric operation) */
export function xorEncrypt(buffer: Buffer, key: Buffer): Buffer {
  const result = Buffer.alloc(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    result[i] = buffer[i] ^ key[i % key.length];
  }
  return result;
}

/** Delete original and thumbnail files for a photo */
export function deletePhotoFiles(photo: { filepath: string; thumbnailPath: string }): void {
  const origPath = path.join(ORIGINALS_DIR, path.basename(photo.filepath));
  const thumbPath = path.join(THUMBNAILS_DIR, path.basename(photo.thumbnailPath));
  try { fs.unlinkSync(origPath); } catch { /* file may not exist */ }
  try { fs.unlinkSync(thumbPath); } catch { /* file may not exist */ }
}
