import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db, schema } from "@/db";
import { bkashExecute } from "@/lib/bkash";
import { baseUrl } from "@/lib/pay";
import { markPayment, settlePayment } from "@/lib/store";

// bKash sends the customer back here: ?paymentID=...&status=success|failure|cancel
export async function GET(req: NextRequest) {
  const paymentID = req.nextUrl.searchParams.get("paymentID") ?? "";
  const status = req.nextUrl.searchParams.get("status") ?? "";
  const base = await baseUrl();
  const d = await db();
  const [payment] = paymentID ? await d.select().from(schema.payments).where(eq(schema.payments.gatewayRef, paymentID)) : [];
  if (!payment || payment.method !== "bkash") return NextResponse.redirect(`${base}/track`, 303);
  const [order] = await d.select().from(schema.orders).where(eq(schema.orders.id, payment.orderId));
  const back = (r: string) => NextResponse.redirect(`${base}/order/${order.code}?pay=${r}`, 303);

  if (payment.status === "paid") return back("ok");
  if (status !== "success") {
    await markPayment(payment.id, status === "cancel" ? "cancelled" : "failed", { callbackStatus: status });
    return back(status === "cancel" ? "cancelled" : "failed");
  }
  try {
    const r = await bkashExecute(paymentID);
    if (r.ok && Math.round(r.amount) === payment.amount) {
      await settlePayment(payment.id, { trxId: r.trxID, raw: r.raw });
      return back("ok");
    }
    if (r.ok) {
      // Paid, but not the amount we asked for: keep it for a person to look at.
      await markPayment(payment.id, "review", r.raw, `Amount mismatch: bKash says ${r.amount}`);
      return back("review");
    }
    await markPayment(payment.id, "failed", r.raw, r.message);
    return back("failed");
  } catch (e) {
    console.error("bKash execute failed", e);
    await markPayment(payment.id, "review", null, "Could not confirm with bKash; check the merchant panel");
    return back("review");
  }
}
