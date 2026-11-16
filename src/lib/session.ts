// Customer sign-in without passwords: a 6-digit code sent by SMS or email, then a signed cookie.
import { createHash, createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { db, schema } from "@/db";
import { emailConfigured, sendEmail, sendSms, smsConfigured } from "./notify";

const COOKIE = "sbd_customer";
const secret = () => process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || "dev-only-secret";
const sign = (v: string) => createHmac("sha256", secret()).update(`c.${v}`).digest("hex");
const hashCode = (contact: string, code: string) => createHash("sha256").update(`${secret()}|${contact}|${code}`).digest("hex");

/** "017 1111-1111" -> "01711111111"; emails are lower-cased. Returns "" when it is neither. */
export function normalizeContact(raw: string): string {
  const v = raw.trim().toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 200) return v;
  const digits = v.replace(/\D/g, "").replace(/^88/, "");
  return /^01[3-9]\d{8}$/.test(digits) ? digits : "";
}
export const isEmail = (c: string) => c.includes("@");
export const canSendTo = (c: string) => (isEmail(c) ? emailConfigured() : smsConfigured());

export async function sendCode(contact: string): Promise<"sent" | "wait" | "unavailable"> {
  if (!canSendTo(contact)) return "unavailable";
  const d = await db();
  const recent = await d.select({ n: sql<number>`count(*)::int` }).from(schema.otps).where(and(eq(schema.otps.contact, contact), gt(schema.otps.createdAt, new Date(Date.now() - 10 * 60_000))));
  if (recent[0].n >= 3) return "wait";
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await d.insert(schema.otps).values({ contact, codeHash: hashCode(contact, code), expiresAt: new Date(Date.now() + 10 * 60_000) });
  const text = `Your SBD Global Shopping code is ${code}. It expires in 10 minutes.`;
  const ok = isEmail(contact) ? await sendEmail(contact, `Your SBD sign-in code: ${code}`, text) : await sendSms(contact, text);
  return ok ? "sent" : "unavailable";
}

export async function verifyCode(contact: string, code: string): Promise<boolean> {
  const d = await db();
  const [row] = await d.select().from(schema.otps)
    .where(and(eq(schema.otps.contact, contact), isNull(schema.otps.usedAt), gt(schema.otps.expiresAt, new Date())))
    .orderBy(desc(schema.otps.id)).limit(1);
  if (!row || row.attempts >= 5) return false;
  const a = Buffer.from(row.codeHash), b = Buffer.from(hashCode(contact, code.replace(/\D/g, "")));
  const ok = a.length === b.length && timingSafeEqual(a, b);
  await d.update(schema.otps).set(ok ? { usedAt: new Date() } : { attempts: row.attempts + 1 }).where(eq(schema.otps.id, row.id));
  return ok;
}

export async function startCustomerSession(contact: string): Promise<void> {
  const expires = Date.now() + 30 * 86400_000;
  const v = `${Buffer.from(contact).toString("base64url")}.${expires}`;
  (await cookies()).set(COOKIE, `${v}.${sign(v)}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: new Date(expires) });
}

export async function endCustomerSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/** The signed-in customer's phone or email, or null. */
export async function currentCustomer(): Promise<string | null> {
  const raw = (await cookies()).get(COOKIE)?.value ?? "";
  const i = raw.lastIndexOf(".");
  if (i < 0) return null;
  const v = raw.slice(0, i), sig = raw.slice(i + 1);
  const a = Buffer.from(sig), b = Buffer.from(sign(v));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const [c, exp] = v.split(".");
  if (Number(exp) < Date.now()) return null;
  return Buffer.from(c, "base64url").toString();
}
