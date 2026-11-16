import { randomBytes } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { computeTotals, type LineKind, type Totals } from "./money";
import { DEFAULTS, receiving, type PayMethod } from "./config";

const { quotes, quoteLines, orders, orderItems, orderEvents, payments } = schema;

export type Quote = typeof quotes.$inferSelect;
export type QuoteLine = typeof quoteLines.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Payment = typeof payments.$inferSelect;

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no look-alike characters
export function newCode(len = 12): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function quoteTotals(q: Pick<Quote, "taxPct" | "servicePct" | "shipping" | "discount">, lines: Pick<QuoteLine, "kind" | "qty" | "price">[], deliveryCharge = 0): Totals {
  return computeTotals({
    lines: lines.map((l) => ({ kind: l.kind as LineKind, qty: l.qty, price: l.price })),
    taxPct: Number(q.taxPct),
    servicePct: Number(q.servicePct),
    shipping: q.shipping,
    discount: q.discount,
    deliveryCharge,
  });
}

// ---------- quotes ----------

export async function createQuote(init: Partial<typeof quotes.$inferInsert> = {}): Promise<Quote> {
  const d = await db();
  const valid = new Date(Date.now() + DEFAULTS.quoteValidDays * 86400_000).toISOString().slice(0, 10);
  const [row] = await d.insert(quotes).values({ number: `tmp-${newCode(8)}`, code: newCode(12), validUntil: valid, ...init }).returning();
  const [q] = await d.update(quotes).set({ number: `Q-${1000 + row.id}` }).where(eq(quotes.id, row.id)).returning();
  return q;
}

export async function getQuote(where: { id: number } | { code: string }): Promise<{ quote: Quote; lines: QuoteLine[] } | null> {
  const d = await db();
  const cond = "id" in where ? eq(quotes.id, where.id) : eq(quotes.code, where.code);
  const [quote] = await d.select().from(quotes).where(cond);
  if (!quote) return null;
  const lines = await d.select().from(quoteLines).where(eq(quoteLines.quoteId, quote.id)).orderBy(asc(quoteLines.position), asc(quoteLines.id));
  return { quote, lines };
}

export interface LineInput { kind: LineKind; name: string; website: string; url: string; imageUrl: string; qty: number; price: number }

export async function saveQuote(id: number, header: Partial<typeof quotes.$inferInsert>, lines: LineInput[]): Promise<void> {
  const d = await db();
  await d.transaction(async (tx) => {
    await tx.update(quotes).set({ ...header, updatedAt: new Date() }).where(eq(quotes.id, id));
    await tx.delete(quoteLines).where(eq(quoteLines.quoteId, id));
    if (lines.length) await tx.insert(quoteLines).values(lines.map((l, i) => ({ ...l, quoteId: id, position: i })));
  });
}

export function quoteIsOpen(q: Quote): boolean {
  if (!["sent", "changes_requested", "draft"].includes(q.status)) return false;
  if (q.validUntil && /^\d{4}-\d{2}-\d{2}$/.test(q.validUntil)) {
    const end = new Date(`${q.validUntil}T23:59:59+06:00`).getTime();
    if (Date.now() > end) return false;
  }
  return true;
}

// ---------- orders ----------

export interface CheckoutInput {
  name: string; phone: string; email: string;
  receiving: string; address: string; district: string;
  note: string; payMethod: PayMethod;
}

export async function createOrderFromQuote(quote: Quote, lines: QuoteLine[], input: CheckoutInput, deliveryChargeTaka = 0): Promise<{ order: Order; payment: Payment }> {
  const d = await db();
  const recv = receiving(input.receiving);
  const charge = recv.needsAddress ? deliveryChargeTaka : 0;
  const totals = quoteTotals(quote, lines, charge);
  return d.transaction(async (tx) => {
    const [tmp] = await tx.insert(orders).values({
      number: `tmp-${newCode(8)}`, code: newCode(14), quoteId: quote.id, customerId: quote.customerId,
      name: input.name, phone: input.phone, email: input.email,
      receiving: recv.key, address: recv.needsAddress ? input.address : "", district: recv.needsAddress ? input.district : "",
      deliveryCharge: charge, total: totals.total, eta: quote.eta, noteCustomer: input.note,
      totals: { ...totals }, tcAgreedAt: new Date(),
    }).returning();
    const [order] = await tx.update(orders).set({ number: `SBD-${10000 + tmp.id}` }).where(eq(orders.id, tmp.id)).returning();
    await tx.insert(orderItems).values(lines.map((l, i) => ({
      orderId: order.id, position: i, kind: l.kind, name: l.name, website: l.website, url: l.url, imageUrl: l.imageUrl, qty: l.qty, price: l.price,
    })));
    const [payment] = await tx.insert(payments).values({ orderId: order.id, method: input.payMethod, amount: totals.total }).returning();
    await tx.insert(orderEvents).values({ orderId: order.id, stage: "awaiting_payment", note: "Order placed" });
    await tx.update(quotes).set({ status: "accepted", acceptedAt: new Date() }).where(eq(quotes.id, quote.id));
    return { order, payment };
  });
}

export async function getOrder(where: { id: number } | { code: string }) {
  const d = await db();
  const cond = "id" in where ? eq(orders.id, where.id) : eq(orders.code, where.code);
  const [order] = await d.select().from(orders).where(cond);
  if (!order) return null;
  const [items, events, pays] = await Promise.all([
    d.select().from(orderItems).where(eq(orderItems.orderId, order.id)).orderBy(asc(orderItems.position)),
    d.select().from(orderEvents).where(eq(orderEvents.orderId, order.id)).orderBy(asc(orderEvents.at), asc(orderEvents.id)),
    d.select().from(payments).where(eq(payments.orderId, order.id)).orderBy(asc(payments.id)),
  ]);
  return { order, items, events, payments: pays };
}

/**
 * Marks a payment as paid exactly once, however many times the gateway calls us
 * (browser redirect and IPN can both arrive). Returns false when it was already settled.
 */
export async function settlePayment(paymentId: number, info: { trxId: string; raw?: unknown; note?: string }): Promise<boolean> {
  const d = await db();
  return d.transaction(async (tx) => {
    const updated = await tx.update(payments)
      .set({ status: "paid", trxId: info.trxId, raw: info.raw ?? null, note: info.note ?? "", paidAt: new Date() })
      .where(and(eq(payments.id, paymentId), sql`${payments.status} <> 'paid'`))
      .returning();
    if (!updated.length) return false;
    const p = updated[0];
    const [order] = await tx.update(orders).set({ paid: sql`${orders.paid} + ${p.amount}` }).where(eq(orders.id, p.orderId)).returning();
    if (order.stage === "awaiting_payment") {
      await tx.update(orders).set({ stage: "confirmed" }).where(eq(orders.id, order.id));
      await tx.insert(orderEvents).values({ orderId: order.id, stage: "confirmed", note: `Payment received (${p.method})` });
    }
    return true;
  });
}

export async function markPayment(paymentId: number, status: "failed" | "cancelled" | "review", raw?: unknown, note = ""): Promise<void> {
  const d = await db();
  await d.update(payments).set({ status, raw: raw ?? null, note })
    .where(and(eq(payments.id, paymentId), sql`${payments.status} <> 'paid'`));
}

export async function setStage(orderId: number, stage: string, note = ""): Promise<void> {
  const d = await db();
  await d.transaction(async (tx) => {
    await tx.update(orders).set({ stage }).where(eq(orders.id, orderId));
    await tx.insert(orderEvents).values({ orderId, stage, note });
  });
}
