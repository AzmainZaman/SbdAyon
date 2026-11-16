// bKash Checkout (URL based), Tokenized API v1.2.0-beta.
// Flow: grant token -> create payment -> customer pays on bKash page -> bKash redirects to our
// callback -> we execute the payment (only when callback status is "success") -> trxID.
// bKash rules followed here: the id_token is reused for up to an hour, never requested per payment;
// execute is called only for a success callback; statusCode "0000" is the only success.

import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

const cfg = () => {
  const c = {
    base: (process.env.BKASH_BASE_URL ?? "https://tokenized.sandbox.bka.sh/v1.2.0-beta").replace(/\/$/, ""),
    username: process.env.BKASH_USERNAME ?? "",
    password: process.env.BKASH_PASSWORD ?? "",
    appKey: process.env.BKASH_APP_KEY ?? "",
    appSecret: process.env.BKASH_APP_SECRET ?? "",
  };
  return c;
};

export const bkashConfigured = () => {
  const c = cfg();
  return Boolean(c.username && c.password && c.appKey && c.appSecret);
};

type Json = Record<string, unknown>;
export type Fetcher = typeof fetch;

async function post(f: Fetcher, url: string, headers: Record<string, string>, body: Json): Promise<Json> {
  const res = await f(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...headers },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  try {
    return JSON.parse(text) as Json;
  } catch {
    throw new Error(`bKash returned a non-JSON response (HTTP ${res.status})`);
  }
}

interface TokenCache { idToken: string; refreshToken: string; expiresAt: number }
const TOKEN_KEY = "bkash_token";

async function getToken(f: Fetcher): Promise<string> {
  const c = cfg();
  const d = await db();
  const [row] = await d.select().from(schema.kv).where(eq(schema.kv.key, TOKEN_KEY));
  const cached = row?.value as TokenCache | undefined;
  const now = Date.now();
  if (cached?.idToken && cached.expiresAt > now + 60_000) return cached.idToken;

  const auth = { username: c.username, password: c.password };
  let r: Json | undefined;
  if (cached?.refreshToken) {
    r = await post(f, `${c.base}/tokenized/checkout/token/refresh`, auth, { app_key: c.appKey, app_secret: c.appSecret, refresh_token: cached.refreshToken });
  }
  if (!r?.id_token) {
    r = await post(f, `${c.base}/tokenized/checkout/token/grant`, auth, { app_key: c.appKey, app_secret: c.appSecret });
  }
  if (!r.id_token) throw new Error(`bKash token request failed: ${String(r.statusMessage ?? r.msg ?? "unknown error")}`);
  const value: TokenCache = {
    idToken: String(r.id_token),
    refreshToken: String(r.refresh_token ?? ""),
    expiresAt: now + Math.min(Number(r.expires_in ?? 3600), 3600) * 1000,
  };
  await d.insert(schema.kv).values({ key: TOKEN_KEY, value }).onConflictDoUpdate({ target: schema.kv.key, set: { value, updatedAt: new Date() } });
  return value.idToken;
}

async function authed(f: Fetcher, path: string, body: Json): Promise<Json> {
  const c = cfg();
  const token = await getToken(f);
  return post(f, `${c.base}${path}`, { authorization: token, "x-app-key": c.appKey }, body);
}

export async function bkashCreate(p: { amount: number; invoice: string; payerReference: string; callbackURL: string }, f: Fetcher = fetch) {
  const r = await authed(f, "/tokenized/checkout/create", {
    mode: "0011",
    payerReference: p.payerReference || "customer",
    callbackURL: p.callbackURL,
    amount: p.amount.toFixed(2),
    currency: "BDT",
    intent: "sale",
    merchantInvoiceNumber: p.invoice,
  });
  if (r.statusCode !== "0000" || !r.bkashURL || !r.paymentID) {
    throw new Error(`bKash could not start the payment: ${String(r.statusMessage ?? r.errorMessage ?? "unknown error")}`);
  }
  return { paymentID: String(r.paymentID), bkashURL: String(r.bkashURL), raw: r };
}

export interface BkashResult { ok: boolean; trxID: string; amount: number; message: string; raw: Json }

function toResult(r: Json): BkashResult {
  const ok = r.statusCode === "0000" && r.transactionStatus === "Completed" && Boolean(r.trxID);
  return { ok, trxID: String(r.trxID ?? ""), amount: Number.parseFloat(String(r.amount ?? "0")), message: String(r.statusMessage ?? r.errorMessage ?? ""), raw: r };
}

export async function bkashExecute(paymentID: string, f: Fetcher = fetch): Promise<BkashResult> {
  let r: Json;
  try {
    r = await authed(f, "/tokenized/checkout/execute", { paymentID });
  } catch {
    // Network trouble during execute: ask bKash what actually happened instead of guessing.
    return bkashQuery(paymentID, f);
  }
  const result = toResult(r);
  if (result.ok) return result;
  // An "already executed" style answer still needs the real state.
  const q = await bkashQuery(paymentID, f).catch(() => null);
  return q?.ok ? q : result;
}

export async function bkashQuery(paymentID: string, f: Fetcher = fetch): Promise<BkashResult> {
  return toResult(await authed(f, "/tokenized/checkout/payment/status", { paymentID }));
}
