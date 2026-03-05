import { NextRequest } from "next/server";
import { checkPassword, createSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { password } = body;

  if (!checkPassword(password)) {
    return Response.json({ error: "Invalid password" }, { status: 401 });
  }

  await createSession();
  return Response.json({ success: true });
}
