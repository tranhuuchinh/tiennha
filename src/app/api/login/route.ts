import { cookies } from "next/headers";
import { checkPasscode, passcodeEnabled, SESSION_COOKIE, sessionToken } from "@/lib/server/auth";

export async function POST(req: Request) {
  const { passcode } = (await req.json().catch(() => ({}))) as { passcode?: string };
  if (!passcodeEnabled()) return Response.json({ ok: true });
  if (typeof passcode !== "string" || !checkPasscode(passcode)) {
    await new Promise((r) => setTimeout(r, 700));
    return Response.json({ error: "Sai mã truy cập" }, { status: 401 });
  }
  (await cookies()).set(SESSION_COOKIE, sessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return Response.json({ ok: true });
}

export async function DELETE() {
  (await cookies()).delete(SESSION_COOKIE);
  return Response.json({ ok: true });
}
