import crypto from "crypto";

const TOKEN_TTL = parseInt(process.env.SAPPHIRE_IMAGE_TOKEN_TTL || "3600", 10); // default 1 hour

let _cachedSecret: string | null = null;
function getSecret(): string {
  if (!_cachedSecret) {
    const pw = process.env.SAPPHIRE_PASSWORD || "sapphire-default-key";
    _cachedSecret = crypto.createHash("sha256").update(`sapphire-image-token:${pw}`).digest("hex");
  }
  return _cachedSecret;
}

/** Sign an image URL with expiration. Returns full URL with ?g=&exp=&sig= params. */
export function signImageUrl(basePath: string, galleryId?: string): string {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL;
  const g = galleryId || "";
  const data = `${basePath}:${g}:${exp}`;
  const sig = crypto.createHmac("sha256", getSecret()).update(data).digest("hex").slice(0, 16);

  const params = new URLSearchParams();
  if (g) params.set("g", g);
  params.set("exp", String(exp));
  params.set("sig", sig);
  return `${basePath}?${params.toString()}`;
}

/** Verify a signed image URL. Returns true if signature is valid and not expired. */
export function verifyImageSignature(
  basePath: string,
  galleryId: string | null,
  exp: string | null,
  sig: string | null
): boolean {
  if (!exp || !sig) return false;
  const expNum = parseInt(exp, 10);
  if (isNaN(expNum) || expNum < Math.floor(Date.now() / 1000)) return false;
  const data = `${basePath}:${galleryId || ""}:${exp}`;
  const expected = crypto.createHmac("sha256", getSecret()).update(data).digest("hex").slice(0, 16);
  if (sig.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

// --- One-time download tokens ---

const downloadTokens = new Map<string, { photoId: string; galleryId: string; exp: number }>();

function purgeExpiredTokens() {
  const now = Date.now();
  for (const [k, v] of downloadTokens) {
    if (v.exp < now) downloadTokens.delete(k);
  }
}

export function createDownloadToken(photoId: string, galleryId: string): string {
  purgeExpiredTokens();
  const token = crypto.randomBytes(24).toString("hex");
  downloadTokens.set(token, { photoId, galleryId, exp: Date.now() + 60_000 }); // 1 minute
  return token;
}

export function consumeDownloadToken(token: string): { photoId: string; galleryId: string } | null {
  const entry = downloadTokens.get(token);
  if (!entry || entry.exp < Date.now()) {
    downloadTokens.delete(token);
    return null;
  }
  downloadTokens.delete(token); // one-time use
  purgeExpiredTokens();
  return { photoId: entry.photoId, galleryId: entry.galleryId };
}
