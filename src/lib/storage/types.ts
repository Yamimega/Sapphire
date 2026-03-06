export interface StorageProvider {
  /** Write a file */
  put(key: string, data: Buffer): Promise<void>;

  /** Read a file, returns null if not found */
  get(key: string): Promise<Buffer | null>;

  /** Delete a file (no error if missing) */
  del(key: string): Promise<void>;

  /** Check if a file exists */
  exists(key: string): Promise<boolean>;

  /** Get file size without reading full content, returns null if not found */
  size(key: string): Promise<number | null>;

  /** List all keys under the given prefix */
  list(prefix: string): Promise<string[]>;

  /** Delete all files under the given prefix */
  deletePrefix(prefix: string): Promise<void>;

  /**
   * Local filesystem directory for uploads (null for remote storage).
   * Used for efficient backup archive streaming.
   */
  readonly localDir: string | null;
}
