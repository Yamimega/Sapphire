import crypto from "crypto";
import { cookies } from "next/headers";

const SESSION_COOKIE = "sapphire-session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function getPassword(): string | undefined {
  return process.env.SAPPHIRE_PASSWORD;
}

function getSecret(): string {
  const pw = getPassword();
  if (!pw) return "";
  return crypto.createHash("sha256").update(pw).digest("hex");
}

function createToken(): string {
  const secret = getSecret();
  const payload = Date.now().toString();
  const hmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${hmac}`;
}

function verifyToken(token: string): boolean {
  const secret = getSecret();
  const [payload, hmac] = token.split(".");
  if (!payload || !hmac) return false;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  if (hmac.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected));
}

export function isAuthEnabled(): boolean {
  return !!getPassword();
}

export function checkPassword(password: string): boolean {
  const expected = getPassword();
  if (!expected) return true;
  // Hash both to fixed-length to avoid leaking password length via early return
  const hashA = crypto.createHash("sha256").update(password).digest();
  const hashB = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export async function createSession(): Promise<void> {
  const token = createToken();
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function isAuthenticated(): Promise<boolean> {
  if (!isAuthEnabled()) return true;
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  return verifyToken(token);
}

export function requireAuthResponse(): Response {
  return Response.json({ error: "Authentication required" }, { status: 401 });
}

// --- Rate limiting ---

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 5; // max attempts per window
const RATE_LIMIT_PURGE_THRESHOLD = 100;

export function checkRateLimit(key: string): boolean {
  const now = Date.now();

  // Purge expired entries when map grows too large
  if (rateLimitMap.size > RATE_LIMIT_PURGE_THRESHOLD) {
    for (const [k, v] of rateLimitMap) {
      if (v.resetAt < now) rateLimitMap.delete(k);
    }
  }

  const entry = rateLimitMap.get(key);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

/** Extract client IP from request headers */
export function getClientIp(request: { headers: { get(name: string): string | null } }): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export function rateLimitResponse(): Response {
  return Response.json({ error: "Too many attempts. Try again later." }, { status: 429 });
}

/** Timing-safe comparison for hex strings of equal expected length */
export function timingSafeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
