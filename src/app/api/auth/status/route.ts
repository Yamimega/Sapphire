import { isAuthenticated, isAuthEnabled } from "@/lib/auth";

export async function GET() {
  return Response.json({
    authenticated: await isAuthenticated(),
    authEnabled: isAuthEnabled(),
  });
}
