import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db, schema } from "@/db";
import { bkashConfigured, bkashCreate } from "./bkash";
import { sslczConfigured, sslczInit } from "./sslcommerz";
import type { Order, Payment } from "./store";

/** The public address of the site, used in the links we hand to the payment gateways. */
export async function baseUrl(): Promise<string> {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Starts the chosen payment and returns the address to send the customer to. */
export async function startPayment(order: Order, payment: Payment, productName: string): Promise<string> {
  const d = await db();
  const base = await baseUrl();
  const orderPage = `${base}/order/${order.code}`;
  if (payment.method === "bkash") {
    if (!bkashConfigured()) return `${orderPage}?pay=unavailable`;
    const r = await bkashCreate({ amount: payment.amount, invoice: `${order.number}-${payment.id}`, payerReference: order.phone || order.number, callbackURL: `${base}/api/pay/bkash/callback` });
    await d.update(schema.payments).set({ gatewayRef: r.paymentID }).where(eq(schema.payments.id, payment.id));
    return r.bkashURL;
  }
  if (payment.method === "sslcommerz") {
    if (!sslczConfigured()) return `${orderPage}?pay=unavailable`;
    const tranId = `${order.number}-${payment.id}`;
    await d.update(schema.payments).set({ gatewayRef: tranId }).where(eq(schema.payments.id, payment.id));
    const r = await sslczInit({
      amount: payment.amount, tranId, baseUrl: base, orderCode: order.code, productName,
      customer: { name: order.name, email: order.email, phone: order.phone, address: order.address, city: order.district },
    });
    return r.url;
  }
  return orderPage; // bank transfer: the order page shows the account details
}
