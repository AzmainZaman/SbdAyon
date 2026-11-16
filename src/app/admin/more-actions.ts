"use server";

import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { COUNTRIES, STAGES, stageLabel } from "@/lib/config";
import { parseCsv } from "@/lib/csv";
import { fetchProduct } from "@/lib/fetchlink";
import { parsePct, parseTaka } from "@/lib/money";
import { notifyOrder } from "@/lib/notify";
import { baseUrl } from "@/lib/pay";
import { deliveryCharge, getSettings, saveSettings } from "@/lib/settings";
import { createOrderFromQuote, getQuote, newCode, settlePayment } from "@/lib/store";

const s = (fd: FormData, k: string, max = 2000) => String(fd.get(k) ?? "").trim().slice(0, max);
const num = (v: unknown) => { const n = Number.parseFloat(String(v ?? "").replace(/[^0-9.]/g, "")); return Number.isFinite(n) ? n : 0; };
const country = (v: string) => ((COUNTRIES as readonly string[]).includes(v) ? v : "USA");
const httpUrl = (v: string) => (/^https?:\/\//i.test(v) ? v.slice(0, 2000) : "");

// ---------- settings ----------
export async function saveSettingsAction(fd: FormData): Promise<void> {
  await requireAdmin();
  const cur = await getSettings();
  for (const c of COUNTRIES) {
    cur.countries[c] = {
      currency: s(fd, `cur_${c}`, 3).toUpperCase() || cur.countries[c].currency,
      rate: num(fd.get(`rate_${c}`)), taxPct: parsePct(fd.get(`tax_${c}`)), shipPerKg: parseTaka(fd.get(`ship_${c}`)),
      days: s(fd, `days_${c}`, 40), nextShipment: s(fd, `next_${c}`, 40), active: fd.get(`active_${c}`) === "on",
    };
  }
  cur.servicePct = parsePct(fd.get("servicePct"));
  cur.deliveryInside = parseTaka(fd.get("deliveryInside"));
  cur.deliveryOutside = parseTaka(fd.get("deliveryOutside"));
  cur.quoteValidDays = Math.min(Math.max(Math.round(num(fd.get("quoteValidDays"))) || 7, 1), 90);
  cur.quoteTerms = s(fd, "quoteTerms", 4000); cur.termsPage = s(fd, "termsPage", 40000); cur.refundPage = s(fd, "refundPage", 20000); cur.hours = s(fd, "hours", 200);
  await saveSettings(cur);
  revalidatePath("/", "layout");
  redirect("/admin/settings?saved=1");
}

// ---------- catalogue ----------
export async function addProduct(fd: FormData): Promise<void> {
  await requireAdmin();
  const d = await db();
  const kind = s(fd, "kind", 10) === "instock" ? "instock" : "preorder";
  const url = httpUrl(s(fd, "url"));
  let name = s(fd, "name", 300), imageUrl = httpUrl(s(fd, "imageUrl")), website = "", price = parseTaka(fd.get("price"));
  if (url && (!name || !imageUrl)) {
    const f = await fetchProduct(url);
    name ||= f.name; imageUrl ||= f.imageUrl; website = f.website;
    if (!price && f.price) { const st = await getSettings(); const c = Object.values(st.countries).find((x) => x.currency === f.currency); if (c?.rate) price = Math.round(f.price * c.rate); }
  }
  const [row] = await d.insert(schema.products).values({ kind, url, name: name || "New product", imageUrl, website: kind === "instock" ? "Ono" : website, price, country: country(s(fd, "country", 40)), visible: false }).returning();
  redirect(`/admin/catalogue?edit=${row.id}`);
}

export async function saveProduct(id: number, fd: FormData): Promise<void> {
  await requireAdmin();
  const d = await db();
  if (s(fd, "intent", 10) === "delete") await d.delete(schema.products).where(eq(schema.products.id, id));
  else await d.update(schema.products).set({
    name: s(fd, "name", 300), description: s(fd, "description", 4000), country: country(s(fd, "country", 40)), website: s(fd, "website", 80),
    url: httpUrl(s(fd, "url")), imageUrl: httpUrl(s(fd, "imageUrl")), price: parseTaka(fd.get("price")), visible: fd.get("visible") === "on",
    kind: s(fd, "kind", 10) === "instock" ? "instock" : "preorder",
  }).where(eq(schema.products.id, id));
  revalidatePath("/", "layout");
  redirect("/admin/catalogue");
}

// ---------- quote helpers ----------
export async function fetchIntoQuote(quoteId: number, fd: FormData): Promise<void> {
  await requireAdmin();
  const url = httpUrl(s(fd, "link"));
  if (!url) redirect(`/admin/quotes/${quoteId}?fetch=bad`);
  const f = await fetchProduct(url);
  const d = await db();
  const found = await getQuote({ id: quoteId });
  if (!found) redirect("/admin/quotes");
  const st = await getSettings();
  const c = Object.values(st.countries).find((x) => x.currency === f.currency);
  await d.insert(schema.quoteLines).values({ quoteId, position: found.lines.length, kind: "item", name: f.name, website: f.website, url, imageUrl: f.imageUrl, qty: 1, price: f.price && c?.rate ? Math.round(f.price * c.rate) : 0 });
  redirect(`/admin/quotes/${quoteId}?fetch=${f.ok ? "ok" : "partial"}`);
}

/** Manual order: staff turns a quote straight into an order for a phone, Facebook or walk-in customer. */
export async function convertQuote(quoteId: number, fd: FormData): Promise<void> {
  await requireAdmin();
  const found = await getQuote({ id: quoteId });
  if (!found || found.quote.status === "accepted" || !found.lines.some((l) => l.kind === "item")) redirect(`/admin/quotes/${quoteId}`);
  const st = await getSettings();
  const recv = s(fd, "receiving", 20);
  const { order, payment } = await createOrderFromQuote(found.quote, found.lines, {
    name: s(fd, "name", 120) || found.quote.customerName, phone: s(fd, "phone", 20), email: s(fd, "email", 200),
    receiving: recv, address: s(fd, "address", 300), district: s(fd, "district", 80), note: s(fd, "note", 1000), payMethod: "manual",
  }, deliveryCharge(st, recv));
  const paid = parseTaka(fd.get("paid"));
  const d = await db();
  // The customer did not tick the Terms box themselves, so do not record that they did.
  await d.update(schema.orders).set({ tcAgreedAt: null }).where(eq(schema.orders.id, order.id));
  if (paid > 0) {
    await d.update(schema.payments).set({ amount: Math.min(paid, order.total) }).where(eq(schema.payments.id, payment.id));
    await settlePayment(payment.id, { trxId: s(fd, "payRef", 120), note: "Recorded by staff when creating the order" });
  } else {
    await d.update(schema.payments).set({ status: "cancelled", note: "No payment recorded at creation" }).where(eq(schema.payments.id, payment.id));
  }
  redirect(`/admin/orders/${order.id}`);
}

// ---------- shipments ----------
export async function saveShipment(fd: FormData): Promise<void> {
  await requireAdmin();
  const d = await db();
  const id = Number(fd.get("id") ?? 0);
  const values = { name: s(fd, "name", 80) || "Shipment", country: country(s(fd, "country", 40)), leaves: s(fd, "leaves", 40), eta: s(fd, "eta", 80) };
  if (id) await d.update(schema.shipments).set(values).where(eq(schema.shipments.id, id));
  else await d.insert(schema.shipments).values(values);
  redirect("/admin/shipments");
}

/** Moves a whole shipment: every order in it gets the new stage (and delivery estimate) and the customer is told. */
export async function moveShipment(id: number, fd: FormData): Promise<void> {
  await requireAdmin();
  const d = await db();
  const stage = s(fd, "stage", 40);
  if (!STAGES.some((x) => x.key === stage && x.tracked)) redirect("/admin/shipments");
  const eta = s(fd, "eta", 80);
  const reason = s(fd, "reason", 300);
  await d.update(schema.shipments).set(eta ? { stage, eta } : { stage }).where(eq(schema.shipments.id, id));
  const list = await d.select().from(schema.orders).where(eq(schema.orders.shipmentId, id));
  const live = list.filter((o) => !["cancelled", "delivered", "awaiting_payment"].includes(o.stage));
  const base = await baseUrl();
  for (const o of live) {
    await d.transaction(async (tx) => {
      await tx.update(schema.orders).set(eta ? { stage, eta, etaReason: reason } : { stage }).where(eq(schema.orders.id, o.id));
      await tx.insert(schema.orderEvents).values({ orderId: o.id, stage, note: reason });
    });
    if (fd.get("notify") === "on") await notifyOrder(o, `${stageLabel(stage)}.${eta ? ` Estimated delivery: ${eta}.` : ""}`, base);
  }
  redirect(`/admin/shipments?moved=${live.length}`);
}

export async function assignShipment(fd: FormData): Promise<void> {
  await requireAdmin();
  const d = await db();
  const ids = fd.getAll("orderId").map(Number).filter(Boolean).slice(0, 500);
  const shipmentId = Number(fd.get("shipmentId") ?? 0) || null;
  if (ids.length) await d.update(schema.orders).set({ shipmentId }).where(inArray(schema.orders.id, ids));
  redirect("/admin/shipments");
}

// ---------- Shopify import ----------
const pick = (r: Record<string, string>, ...keys: string[]) => { for (const k of keys) if (r[k]) return r[k]; return ""; };

export async function importShopify(_prev: { message?: string }, fd: FormData): Promise<{ message?: string }> {
  await requireAdmin();
  const d = await db();
  const out: string[] = [];
  const cf = fd.get("customers");
  if (cf instanceof File && cf.size > 0) {
    if (cf.size > 20_000_000) return { message: "The customers file is too large (20 MB limit)." };
    const rows = parseCsv(await cf.text());
    const existing = await d.select({ phone: schema.customers.phone, email: schema.customers.email }).from(schema.customers);
    const seen = new Set(existing.flatMap((c) => [c.phone, c.email]).filter(Boolean) as string[]);
    let added = 0;
    for (const r of rows) {
      const email = pick(r, "Email").toLowerCase();
      const phone = pick(r, "Phone", "Default Address Phone").replace(/[^\d+]/g, "");
      const name = [pick(r, "First Name"), pick(r, "Last Name")].filter(Boolean).join(" ") || pick(r, "Default Address Name");
      if ((!email && !phone) || (email && seen.has(email)) || (phone && seen.has(phone))) continue;
      await d.insert(schema.customers).values({ name, email: email || null, phone: phone || null, source: "shopify" });
      if (email) seen.add(email); if (phone) seen.add(phone);
      added++;
    }
    out.push(`${added} customers added (${rows.length - added} skipped as duplicates or empty).`);
  }
  const of = fd.get("orders");
  if (of instanceof File && of.size > 0) {
    if (of.size > 20_000_000) return { message: "The orders file is too large (20 MB limit)." };
    const rows = parseCsv(await of.text());
    // Shopify repeats the order name on every line item; only the first row carries the totals.
    const groups = new Map<string, Record<string, string>[]>();
    for (const r of rows) { const n = pick(r, "Name"); if (n) groups.set(n, [...(groups.get(n) ?? []), r]); }
    const names = [...groups.keys()].map((n) => `SH-${n.replace(/^#/, "")}`);
    const have = new Set(names.length ? (await d.select({ number: schema.orders.number }).from(schema.orders).where(inArray(schema.orders.number, names))).map((x) => x.number) : []);
    let added = 0;
    for (const [n, lines] of groups) {
      const number = `SH-${n.replace(/^#/, "")}`;
      if (have.has(number)) continue;
      const h = lines[0];
      const total = parseTaka(pick(h, "Total"));
      const financial = pick(h, "Financial Status").toLowerCase();
      const fulfilled = pick(h, "Fulfillment Status").toLowerCase() === "fulfilled";
      const paid = financial === "paid" ? total : financial === "partially_paid" ? Math.max(total - parseTaka(pick(h, "Outstanding Balance")), 0) : 0;
      const created = new Date(pick(h, "Created at") || Date.now());
      await d.transaction(async (tx) => {
        const [o] = await tx.insert(schema.orders).values({
          number, code: newCode(14), name: pick(h, "Shipping Name", "Billing Name"), phone: pick(h, "Shipping Phone", "Billing Phone", "Phone").replace(/[^\d+]/g, ""), email: pick(h, "Email").toLowerCase(),
          receiving: pick(h, "Shipping Street", "Shipping Address1") ? "inside_dhaka" : "pickup", address: pick(h, "Shipping Street", "Shipping Address1").slice(0, 300), district: pick(h, "Shipping City").slice(0, 80),
          total, paid, stage: financial === "voided" || pick(h, "Cancelled at") ? "cancelled" : fulfilled ? "delivered" : paid >= total && total > 0 ? "confirmed" : "awaiting_payment",
          noteCustomer: pick(h, "Notes").slice(0, 1000), createdAt: Number.isNaN(created.getTime()) ? new Date() : created,
        }).returning();
        await tx.insert(schema.orderItems).values(lines.filter((l) => pick(l, "Lineitem name")).map((l, i) => ({
          orderId: o.id, position: i, name: pick(l, "Lineitem name").slice(0, 500), qty: Math.max(Number.parseInt(pick(l, "Lineitem quantity"), 10) || 1, 1), price: parseTaka(pick(l, "Lineitem price")),
        })));
        await tx.insert(schema.orderEvents).values({ orderId: o.id, stage: o.stage, note: "Imported from Shopify", at: o.createdAt });
        if (paid > 0) await tx.insert(schema.payments).values({ orderId: o.id, method: "manual", amount: paid, status: "paid", note: `Imported from Shopify (${pick(h, "Payment Method") || "paid"})`, paidAt: o.createdAt });
      });
      added++;
    }
    out.push(`${added} orders added as SH-<Shopify number> (${groups.size - added} already imported).`);
  }
  revalidatePath("/admin/customers");
  return { message: out.join(" ") || "Choose at least one CSV file." };
}
