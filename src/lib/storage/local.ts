import fs from "fs";
import { writeFile, unlink, readdir, rm, stat, readFile } from "fs/promises";
import path from "path";
import type { StorageProvider } from "./types";

export class LocalStorageProvider implements StorageProvider {
  private baseDir: string;

  constructor(baseDir: string, subdirs: readonly string[]) {
    this.baseDir = baseDir;
    for (const dir of subdirs) {
      fs.mkdirSync(path.join(baseDir, dir), { recursive: true });
    }
  }

  get localDir() {
    return this.baseDir;
  }

  private resolve(key: string): string {
    // Normalize to forward slashes before resolving (Windows compat)
    const normalized = key.replace(/\\/g, "/");
    const resolved = path.resolve(this.baseDir, normalized);
    if (!resolved.startsWith(path.resolve(this.baseDir))) {
      throw new Error("Invalid storage key");
    }
    return resolved;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const filePath = this.resolve(key);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, data);
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.resolve(key));
    } catch {
      return null;
    }
  }

  async del(key: string): Promise<void> {
    try {
      await unlink(this.resolve(key));
    } catch (err: any) {
      if (err?.code !== "ENOENT") throw err;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await stat(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }

  async size(key: string): Promise<number | null> {
    try {
      const s = await stat(this.resolve(key));
      return s.size;
    } catch {
      return null;
    }
  }

  async list(prefix: string): Promise<string[]> {
    const dir = this.resolve(prefix);
    try {
      const entries = await readdir(dir, { withFileTypes: true, recursive: true });
      return entries
        .filter((e) => e.isFile())
        .map((e) => {
          const full = path.join(e.parentPath ?? e.path, e.name);
          return path.relative(this.baseDir, full).replace(/\\/g, "/");
        });
    } catch {
      return [];
    }
  }

  async deletePrefix(prefix: string): Promise<void> {
    if (!prefix) {
      // Delete contents of baseDir, not baseDir itself
      try {
        const entries = await readdir(this.baseDir);
        await Promise.all(
          entries.map((entry) => rm(path.join(this.baseDir, entry), { recursive: true, force: true }))
        );
      } catch {
        /* directory may not exist */
      }
      return;
    }
    const dir = this.resolve(prefix);
    try {
      await rm(dir, { recursive: true, force: true });
    } catch {
      /* directory may not exist */
    }
  }
}
