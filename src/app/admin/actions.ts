"use server";

import { and, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { checkPassword, endSession, requireAdmin, startSession } from "@/lib/auth";
import { COUNTRIES, STAGES, stageLabel } from "@/lib/config";
import { notifyOrder } from "@/lib/notify";
import { baseUrl } from "@/lib/pay";
import { parsePct, parseTaka, type LineKind } from "@/lib/money";
import { createQuote, saveQuote, setStage, settlePayment, markPayment, type LineInput } from "@/lib/store";

const s = (fd: FormData, k: string, max = 2000) => String(fd.get(k) ?? "").trim().slice(0, max);
const KINDS: LineKind[] = ["item", "text", "heading", "charge"];

export async function login(_prev: { error?: string }, fd: FormData): Promise<{ error?: string }> {
  let ok = false;
  try { ok = checkPassword(s(fd, "password", 200)); } catch { return { error: "Admin password is not set up on the server yet." }; }
  if (!ok) { await new Promise((r) => setTimeout(r, 800)); return { error: "Wrong password." }; }
  await startSession();
  redirect("/admin");
}

export async function logout(): Promise<void> {
  await endSession();
  redirect("/admin/login");
}

export async function newQuote(): Promise<void> {
  await requireAdmin();
  const q = await createQuote();
  redirect(`/admin/quotes/${q.id}`);
}

function readLines(fd: FormData): LineInput[] {
  const all = (k: string) => fd.getAll(k).map((v) => String(v));
  const kinds = all("kind"), names = all("name"), sites = all("website"), urls = all("url"), imgs = all("imageUrl"), qtys = all("qty"), prices = all("price");
  return kinds.slice(0, 200).map((kind, i) => {
    const k = (KINDS.includes(kind as LineKind) ? kind : "item") as LineKind;
    const priced = k === "item" || k === "charge";
    const cleanUrl = (u: string) => (/^https?:\/\//i.test(u.trim()) ? u.trim().slice(0, 2000) : "");
    return {
      kind: k,
      name: (names[i] ?? "").trim().slice(0, 500),
      website: k === "item" ? (sites[i] ?? "").trim().slice(0, 80) : "",
      url: k === "item" ? cleanUrl(urls[i] ?? "") : "",
      imageUrl: k === "item" ? cleanUrl(imgs[i] ?? "") : "",
      qty: k === "item" ? Math.min(Math.max(Number.parseInt(qtys[i] ?? "1", 10) || 1, 1), 999) : 1,
      price: priced ? (k === "charge" && /^\s*-/.test(prices[i] ?? "") ? -parseTaka((prices[i] ?? "").replace("-", "")) : parseTaka(prices[i])) : 0,
    };
  });
}

export async function saveQuoteAction(id: number, fd: FormData): Promise<void> {
  await requireAdmin();
  const intent = s(fd, "intent", 40) || "save";
  let lines = readLines(fd);
  const blank = (kind: LineKind): LineInput => ({ kind, name: "", website: kind === "item" ? "Amazon" : "", url: "", imageUrl: "", qty: 1, price: 0 });
  if (intent.startsWith("add:")) lines.push(blank((KINDS.find((k) => k === intent.slice(4)) ?? "item")));
  if (intent.startsWith("del:")) lines = lines.filter((_, i) => i !== Number(intent.slice(4)));
  if (intent.startsWith("up:")) { const i = Number(intent.slice(3)); if (i > 0 && i < lines.length) [lines[i - 1], lines[i]] = [lines[i], lines[i - 1]]; }
  const country = s(fd, "country", 40);
  const header: Parameters<typeof saveQuote>[1] = {
    customerName: s(fd, "customerName", 120), customerContact: s(fd, "customerContact", 200), source: s(fd, "source", 40),
    country: (COUNTRIES as readonly string[]).includes(country) ? country : "USA",
    taxPct: String(parsePct(fd.get("taxPct"))), servicePct: String(parsePct(fd.get("servicePct"))),
    shipping: parseTaka(fd.get("shipping")), discount: Math.abs(parseTaka(fd.get("discount"))),
    eta: s(fd, "eta", 120), validUntil: s(fd, "validUntil", 10),
    noteCustomer: s(fd, "noteCustomer"), noteInternal: s(fd, "noteInternal"), terms: s(fd, "terms"),
  };
  if (intent === "send") header.status = "sent";
  if (intent === "cancel") header.status = "cancelled";
  await saveQuote(id, header, lines);
  revalidatePath(`/admin/quotes/${id}`);
  redirect(`/admin/quotes/${id}${intent === "send" ? "?shared=1" : ""}`);
}

async function tell(orderId: number, message: string): Promise<void> {
  const d = await db();
  const [o] = await d.select().from(schema.orders).where(eq(schema.orders.id, orderId));
  if (o) await notifyOrder(o, message, await baseUrl());
}

export async function updateOrder(id: number, fd: FormData): Promise<void> {
  await requireAdmin();
  const d = await db();
  const intent = s(fd, "intent", 40);
  if (intent === "stage") {
    const stage = s(fd, "stage", 40);
    if (STAGES.some((x) => x.key === stage)) {
      await setStage(id, stage, s(fd, "stageNote", 300));
      if (fd.get("notify") === "on") await tell(id, `${stageLabel(stage)}.`);
    }
  } else if (intent === "eta") {
    const eta = s(fd, "eta", 120), reason = s(fd, "etaReason", 300);
    await d.update(schema.orders).set({ eta, etaReason: reason }).where(eq(schema.orders.id, id));
    if (fd.get("notify") === "on") await tell(id, `New estimated delivery: ${eta}.${reason ? ` ${reason}` : ""}`);
  } else if (intent === "notes") {
    await d.update(schema.orders).set({ noteInternal: s(fd, "noteInternal"), showSerials: fd.get("showSerials") === "on" }).where(eq(schema.orders.id, id));
  } else if (intent === "items") {
    const ids = fd.getAll("itemId").map(Number);
    const serials = fd.getAll("serials").map(String), store = fd.getAll("storeOrderNo").map(String), tracking = fd.getAll("tracking").map(String), cost = fd.getAll("cost");
    for (let i = 0; i < ids.length; i++) {
      await d.update(schema.orderItems)
        .set({ serials: (serials[i] ?? "").trim().slice(0, 500), storeOrderNo: (store[i] ?? "").trim().slice(0, 120), tracking: (tracking[i] ?? "").trim().slice(0, 120), cost: parseTaka(cost[i]) })
        .where(and(eq(schema.orderItems.id, ids[i]), eq(schema.orderItems.orderId, id)));
    }
  } else if (intent === "manualPayment") {
    const amount = parseTaka(fd.get("amount"));
    if (amount > 0) {
      const [p] = await d.insert(schema.payments).values({ orderId: id, method: "manual", amount, note: s(fd, "payNote", 200) }).returning();
      await settlePayment(p.id, { trxId: s(fd, "payRef", 120), note: s(fd, "payNote", 200) });
    }
  } else if (intent.startsWith("verify:") || intent.startsWith("reject:")) {
    const pid = Number(intent.split(":")[1]);
    const [p] = await d.select().from(schema.payments).where(and(eq(schema.payments.id, pid), eq(schema.payments.orderId, id)));
    if (p && p.status !== "paid") {
      if (intent.startsWith("verify:")) await settlePayment(p.id, { trxId: p.trxId || p.note, raw: p.raw, note: `Verified by staff. ${p.note}`.trim() });
      else await markPayment(p.id, "failed", p.raw, `Rejected by staff. ${p.note}`.trim());
    }
  } else if (intent === "cancelOrder") {
    await d.update(schema.payments).set({ status: "cancelled" }).where(and(eq(schema.payments.orderId, id), sql`${schema.payments.status} in ('pending','review')`));
    await setStage(id, "cancelled", s(fd, "stageNote", 300));
  }
  revalidatePath(`/admin/orders/${id}`);
  redirect(`/admin/orders/${id}`);
}
