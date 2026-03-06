import type { StorageProvider } from "./types";

interface S3Config {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  prefix: string;
}

export class S3StorageProvider implements StorageProvider {
  private client: any;
  private bucket: string;
  private prefix: string;
  private S3: any;

  constructor(config: S3Config) {
    // Lazy-load AWS SDK to avoid import when not used
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sdk = require("@aws-sdk/client-s3");
    this.S3 = sdk;
    this.bucket = config.bucket;
    this.prefix = config.prefix;
    this.client = new sdk.S3Client({
      region: config.region,
      endpoint: config.endpoint || undefined,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: !!config.endpoint,
    });
  }

  get localDir() {
    return null;
  }

  private fullKey(key: string): string {
    // Check for ".." as a path component (not substring — "foo..bar" is valid)
    if (/(^|\/)\.\.(\/|$)/.test(key)) throw new Error("Invalid storage key");
    return this.prefix ? `${this.prefix}${key}` : key;
  }

  async put(key: string, data: Buffer): Promise<void> {
    await this.client.send(
      new this.S3.PutObjectCommand({
        Bucket: this.bucket,
        Key: this.fullKey(key),
        Body: data,
      })
    );
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      const res = await this.client.send(
        new this.S3.GetObjectCommand({
          Bucket: this.bucket,
          Key: this.fullKey(key),
        })
      );
      const chunks: Uint8Array[] = [];
      for await (const chunk of res.Body) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    } catch (err: any) {
      if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) {
        return null;
      }
      throw err;
    }
  }

  async del(key: string): Promise<void> {
    // S3 DeleteObject is idempotent — does not throw for missing keys
    await this.client.send(
      new this.S3.DeleteObjectCommand({
        Bucket: this.bucket,
        Key: this.fullKey(key),
      })
    );
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new this.S3.HeadObjectCommand({
          Bucket: this.bucket,
          Key: this.fullKey(key),
        })
      );
      return true;
    } catch {
      return false;
    }
  }

  async size(key: string): Promise<number | null> {
    try {
      const res = await this.client.send(
        new this.S3.HeadObjectCommand({
          Bucket: this.bucket,
          Key: this.fullKey(key),
        })
      );
      return res.ContentLength ?? null;
    } catch {
      return null;
    }
  }

  async list(prefix: string): Promise<string[]> {
    const fullPrefix = this.fullKey(prefix);
    const keys: string[] = [];
    let continuationToken: string | undefined;

    do {
      const res: any = await this.client.send(
        new this.S3.ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: fullPrefix,
          ContinuationToken: continuationToken,
        })
      );
      for (const obj of res.Contents ?? []) {
        // Strip the storage prefix to return relative keys
        const relative = this.prefix ? obj.Key.slice(this.prefix.length) : obj.Key;
        keys.push(relative);
      }
      continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (continuationToken);

    return keys;
  }

  async deletePrefix(prefix: string): Promise<void> {
    const keys = await this.list(prefix);
    // S3 DeleteObjects supports up to 1000 keys per request
    for (let i = 0; i < keys.length; i += 1000) {
      const batch = keys.slice(i, i + 1000);
      await this.client.send(
        new this.S3.DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: {
            Objects: batch.map((k) => ({ Key: this.fullKey(k) })),
            Quiet: true,
          },
        })
      );
    }
  }
}
