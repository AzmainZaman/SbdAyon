import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db, schema } from "@/db";
import { baseUrl } from "@/lib/pay";
import { sslczValidate } from "@/lib/sslcommerz";
import { markPayment, settlePayment } from "@/lib/store";

// SSLCOMMERZ posts here four ways: success / fail / cancel (the customer's browser) and ipn (server to server).
// Nothing in the posted form is trusted: a payment is marked paid only after the Order Validation API
// confirms it and its tran_id, amount and currency match our own record.
export async function POST(req: NextRequest, ctx: { params: Promise<{ result: string }> }) {
  const { result } = await ctx.params;
  const form = await req.formData().catch(() => new FormData());
  const tranId = String(form.get("tran_id") ?? "");
  const valId = String(form.get("val_id") ?? "");
  const isIpn = result === "ipn";
  const base = await baseUrl();
  const d = await db();
  const [payment] = tranId ? await d.select().from(schema.payments).where(eq(schema.payments.gatewayRef, tranId)) : [];
  if (!payment || payment.method !== "sslcommerz") return isIpn ? new NextResponse("unknown transaction", { status: 200 }) : NextResponse.redirect(`${base}/track`, 303);
  const [order] = await d.select().from(schema.orders).where(eq(schema.orders.id, payment.orderId));
  const done = (r: string) => (isIpn ? new NextResponse(r, { status: 200 }) : NextResponse.redirect(`${base}/order/${order.code}?pay=${r}`, 303));

  if (payment.status === "paid") return done("ok");
  if (!valId) {
    if (result === "cancel") { await markPayment(payment.id, "cancelled"); return done("cancelled"); }
    if (result === "fail") { await markPayment(payment.id, "failed", { status: String(form.get("status") ?? "") }, String(form.get("error") ?? "")); return done("failed"); }
    return done(isIpn ? "ignored" : "failed");
  }
  try {
    const v = await sslczValidate(valId);
    const matches = v.tranId === payment.gatewayRef && Math.round(v.amount) === payment.amount && v.currency === "BDT";
    if (v.ok && matches && v.riskLevel !== "1") {
      await settlePayment(payment.id, { trxId: v.bankTranId, raw: v.raw, note: v.cardType });
      return done("ok");
    }
    if (v.ok && matches) {
      // SSLCOMMERZ flagged this payment as risky: hold it for a person to approve.
      await markPayment(payment.id, "review", v.raw, "Flagged high risk by SSLCOMMERZ");
      return done("review");
    }
    await markPayment(payment.id, "failed", v.raw, v.ok ? "Validation did not match the order" : "Not validated");
    return done("failed");
  } catch (e) {
    console.error("SSLCOMMERZ validation failed", e);
    return done(isIpn ? "retry" : "review");
  }
}
