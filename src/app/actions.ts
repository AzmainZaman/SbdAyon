"use server";

import { and, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { RECEIVING, receiving } from "@/lib/config";
import { startPayment } from "@/lib/pay";
import { deliveryCharge, getSettings } from "@/lib/settings";
import { createOrderFromQuote, createQuote, getOrder, getQuote, quoteIsOpen, saveQuote } from "@/lib/store";
import { websiteName } from "@/lib/fetchlink";
import { canSendTo, endCustomerSession, normalizeContact, sendCode, startCustomerSession, verifyCode } from "@/lib/session";

const str = (max: number) => z.string().trim().max(max);
const phoneRe = /^(?:\+?88)?01[3-9]\d{8}$/;

export async function requestChanges(code: string, formData: FormData): Promise<void> {
  const text = str(1000).parse(formData.get("changes") ?? "");
  const found = await getQuote({ code });
  if (!found || !quoteIsOpen(found.quote) || !text) redirect(`/q/${code}`);
  const d = await db();
  await d.update(schema.quotes).set({ status: "changes_requested", changeRequest: text, updatedAt: new Date() }).where(eq(schema.quotes.id, found.quote.id));
  redirect(`/q/${code}?sent=1`);
}

const checkoutSchema = z.object({
  name: str(120).min(2, "Please enter your name"),
  phone: z.string().trim().transform((v) => v.replace(/[\s-]/g, "")).refine((v) => phoneRe.test(v), "Please enter a valid Bangladeshi mobile number"),
  email: z.union([z.literal(""), z.string().trim().email("Please check the email address").max(200)]),
  receiving: z.enum(RECEIVING.map((r) => r.key) as [string, ...string[]]),
  address: str(300),
  district: str(80),
  note: str(1000),
  payMethod: z.enum(["bkash", "sslcommerz", "bank"]),
  agree: z.literal("on", { message: "Please agree to the Terms & Conditions to continue" }),
});

export interface CheckoutState { error?: string }

export async function placeOrder(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const code = str(40).parse(formData.get("code") ?? "");
  const parsed = checkoutSchema.safeParse(Object.fromEntries(["name", "phone", "email", "receiving", "address", "district", "note", "payMethod", "agree"].map((k) => [k, formData.get(k) ?? ""])));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const input = parsed.data;
  if (receiving(input.receiving).needsAddress && (input.address.length < 5 || !input.district)) return { error: "Please enter your delivery address and district" };

  const found = await getQuote({ code });
  if (!found) return { error: "This quote link is not valid." };
  if (found.quote.status === "accepted") return { error: "This quote was already accepted. Open your order link, or contact SBD." };
  if (!quoteIsOpen(found.quote)) return { error: "This quote has expired. Please ask SBD for an updated quote." };
  if (!found.lines.some((l) => l.kind === "item")) return { error: "This quote has no items yet." };

  const settings = await getSettings();
  const { order, payment } = await createOrderFromQuote(found.quote, found.lines, { ...input, payMethod: input.payMethod }, deliveryCharge(settings, input.receiving));
  let url: string;
  try {
    url = await startPayment(order, payment, `Order ${order.number}`);
  } catch (e) {
    console.error("startPayment failed", e);
    url = `/order/${order.code}?pay=error`;
  }
  redirect(url);
}

/** From the order page: choose another way to pay for an unpaid order. */
export async function payAgain(code: string, formData: FormData): Promise<void> {
  const method = z.enum(["bkash", "sslcommerz", "bank"]).parse(formData.get("method"));
  const found = await getOrder({ code });
  if (!found) redirect("/track");
  const { order } = found;
  const due = order.total - order.paid;
  if (due <= 0 || order.stage === "cancelled") redirect(`/order/${code}`);
  const d = await db();
  // Close older unfinished attempts so only one payment is open at a time.
  await d.update(schema.payments).set({ status: "cancelled" }).where(and(eq(schema.payments.orderId, order.id), sql`${schema.payments.status} = 'pending'`));
  const [payment] = await d.insert(schema.payments).values({ orderId: order.id, method, amount: due }).returning();
  let url: string;
  try {
    url = await startPayment(order, payment, `Order ${order.number}`);
  } catch (e) {
    console.error("startPayment failed", e);
    url = `/order/${code}?pay=error`;
  }
  redirect(url);
}

/** Bank transfer: the customer tells us the transfer is done so staff can verify it. */
export async function submitBankProof(code: string, formData: FormData): Promise<void> {
  const ref = str(200).parse(formData.get("reference") ?? "");
  const found = await getOrder({ code });
  if (!found || ref.length < 3) redirect(`/order/${code}?proof=missing`);
  const open = found.payments.find((p) => p.method === "bank" && (p.status === "pending" || p.status === "review"));
  if (!open) redirect(`/order/${code}`);
  const d = await db();
  await d.update(schema.payments).set({ status: "review", note: ref }).where(eq(schema.payments.id, open.id));
  redirect(`/order/${code}?proof=sent`);
}

export async function trackLookup(_prev: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  const number = str(40).parse(formData.get("number") ?? "").toUpperCase();
  const phone = String(formData.get("phone") ?? "").replace(/\D/g, "").slice(-10);
  if (!number || phone.length < 10) return { error: "Enter your order number and the phone number used for the order." };
  const d = await db();
  const [order] = await d.select().from(schema.orders).where(eq(schema.orders.number, number));
  // Same message either way, so order numbers cannot be guessed one by one.
  if (!order || order.phone.replace(/\D/g, "").slice(-10) !== phone) return { error: "We could not find an order with that number and phone." };
  redirect(`/order/${order.code}`);
}

// ---------- quote request from the website ----------
export async function requestQuote(_prev: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  const name = str(120).parse(formData.get("name") ?? "");
  const contact = normalizeContact(String(formData.get("contact") ?? ""));
  const note = str(1000).parse(formData.get("note") ?? "");
  const productId = Number(formData.get("productId") ?? 0);
  if (String(formData.get("website") ?? "")) return {}; // hidden field only robots fill in
  if (name.length < 2) return { error: "Please enter your name." };
  if (!contact) return { error: "Please enter a valid mobile number (01XXXXXXXXX) or email so we can send your quote." };
  const links = String(formData.get("links") ?? "").split(/\s+/).map((l) => l.trim()).filter((l) => /^https?:\/\/[^\s]{4,}$/i.test(l)).slice(0, 10);
  const d = await db();
  const [product] = productId ? await d.select().from(schema.products).where(eq(schema.products.id, productId)) : [];
  if (!links.length && !product && note.length < 5) return { error: "Paste at least one product link, or describe the product in the note." };
  // One contact cannot flood the request list.
  const [recent] = await d.select({ n: sql<number>`count(*)::int` }).from(schema.quotes).where(and(eq(schema.quotes.customerContact, contact), eq(schema.quotes.status, "request"), sql`${schema.quotes.createdAt} > now() - interval '1 hour'`));
  if (recent.n >= 5) return { error: "We already have your recent requests. We will reply soon." };
  const st = await getSettings();
  const q = await createQuote({ customerName: name, customerContact: contact, source: "Website", status: "request", country: product?.country ?? "USA", noteInternal: note ? `Customer wrote: ${note}` : "", terms: st.quoteTerms, taxPct: String(st.countries[product?.country ?? "USA"]?.taxPct ?? 0), servicePct: String(st.servicePct) });
  const lines = [
    ...(product && product.kind === "preorder" ? [{ kind: "item" as const, name: product.name, website: product.website, url: product.url, imageUrl: product.imageUrl, qty: 1, price: product.price }] : []),
    ...links.map((url) => { let site = ""; try { site = websiteName(new URL(url)); } catch { /* ignore */ } return { kind: "item" as const, name: "", website: site, url: url.slice(0, 2000), imageUrl: "", qty: 1, price: 0 }; }),
  ];
  await saveQuote(q.id, {}, lines);
  redirect("/request?sent=1");
}

// ---------- customer sign-in ----------
export interface LoginState { step: "contact" | "code"; contact?: string; error?: string }

export async function loginStep(prev: LoginState, formData: FormData): Promise<LoginState> {
  if (prev.step === "contact" || formData.get("restart")) {
    if (formData.get("restart")) return { step: "contact" };
    const contact = normalizeContact(String(formData.get("contact") ?? ""));
    if (!contact) return { step: "contact", error: "Enter a mobile number (01XXXXXXXXX) or an email address." };
    if (!canSendTo(contact)) return { step: "contact", error: contact.includes("@") ? "Email sign-in is not switched on yet. Please use your order link, or Track order." : "SMS sign-in is not switched on yet. Try your email, or use Track order." };
    const r = await sendCode(contact);
    if (r === "wait") return { step: "contact", error: "Too many codes requested. Please wait ten minutes." };
    if (r === "unavailable") return { step: "contact", error: "We could not send the code. Please try again shortly." };
    return { step: "code", contact };
  }
  const contact = prev.contact ?? "";
  if (!(await verifyCode(contact, String(formData.get("code") ?? "")))) return { step: "code", contact, error: "That code is not right or has expired." };
  await startCustomerSession(contact);
  redirect("/account");
}

export async function customerLogout(): Promise<void> {
  await endCustomerSession();
  redirect("/");
}
