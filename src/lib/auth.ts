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
  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected));
}

export function isAuthEnabled(): boolean {
  return !!getPassword();
}

export function checkPassword(password: string): boolean {
  const expected = getPassword();
  if (!expected) return true;
  return password === expected;
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
