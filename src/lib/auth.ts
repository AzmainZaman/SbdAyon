// Staff sign-in for the admin panel. First version: one shared admin password kept in the
// ADMIN_PASSWORD setting on the hosting side (never in the code). Per-staff accounts come later.

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE = "sbd_admin";
const DAY = 86400_000;

function secret(): string {
  const s = process.env.ADMIN_PASSWORD;
  if (!s || s.length < 10) throw new Error("ADMIN_PASSWORD is not set (use at least 10 characters).");
  return s;
}

function sign(expires: number): string {
  return createHmac("sha256", secret()).update(`admin.${expires}`).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function checkPassword(input: string): boolean {
  return safeEqual(createHmac("sha256", "pw").update(input).digest("hex"), createHmac("sha256", "pw").update(secret()).digest("hex"));
}

export async function startSession(): Promise<void> {
  const expires = Date.now() + 14 * DAY;
  (await cookies()).set(COOKIE, `${expires}.${sign(expires)}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: new Date(expires) });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export async function isAdmin(): Promise<boolean> {
  const v = (await cookies()).get(COOKIE)?.value ?? "";
  const [exp, sig] = v.split(".");
  const expires = Number(exp);
  if (!expires || !sig || expires < Date.now()) return false;
  try {
    return safeEqual(sig, sign(expires));
  } catch {
    return false;
  }
}

/** Call at the top of every admin page and admin action. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
}
