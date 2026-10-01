import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "tn_session";

export const passcodeEnabled = () => Boolean(process.env.APP_PASSCODE);

export function sessionToken() {
  return createHash("sha256")
    .update(`tiennha:${process.env.APP_PASSCODE ?? ""}`)
    .digest("hex");
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function checkPasscode(input: string) {
  return safeEqual(input.trim(), process.env.APP_PASSCODE ?? "");
}

export async function isAuthed() {
  if (!passcodeEnabled()) return true;
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  return Boolean(value) && safeEqual(value!, sessionToken());
}
