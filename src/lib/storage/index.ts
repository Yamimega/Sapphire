import { UPLOADS_DIR, UPLOAD_SUBDIRS } from "../constants";
import type { StorageProvider } from "./types";

export type { StorageProvider } from "./types";

const globalForStorage = globalThis as unknown as {
  _storage: StorageProvider | undefined;
};

function initStorage(): StorageProvider {
  const provider = process.env.STORAGE_PROVIDER?.toLowerCase();

  if (provider === "s3") {
    const bucket = process.env.S3_BUCKET;
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

    if (!bucket || !accessKeyId || !secretAccessKey) {
      throw new Error(
        "S3 storage requires S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY"
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { S3StorageProvider } = require("./s3");
    return new S3StorageProvider({
      bucket,
      region: process.env.S3_REGION || "us-east-1",
      endpoint: process.env.S3_ENDPOINT || "",
      accessKeyId,
      secretAccessKey,
      prefix: process.env.S3_PREFIX || "",
    });
  }

  // Default: local filesystem
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { LocalStorageProvider } = require("./local");
  return new LocalStorageProvider(UPLOADS_DIR, UPLOAD_SUBDIRS);
}

if (!globalForStorage._storage) {
  globalForStorage._storage = initStorage();
}

export const storage: StorageProvider = globalForStorage._storage!;
