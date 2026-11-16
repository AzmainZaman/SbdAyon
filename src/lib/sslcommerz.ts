// SSLCOMMERZ API v4 (https://developer.sslcommerz.com/doc/v4/).
// Flow: create session -> customer pays on the SSLCOMMERZ page -> SSLCOMMERZ posts to our
// success/fail/cancel URL and to the IPN URL -> we confirm with the Order Validation API
// and compare tran_id, amount and currency with our own record before marking anything paid.

import type { Fetcher } from "./bkash";

const cfg = () => {
  const live = process.env.SSLCZ_LIVE === "true";
  const host = live ? "https://securepay.sslcommerz.com" : "https://sandbox.sslcommerz.com";
  return { host, storeId: process.env.SSLCZ_STORE_ID ?? "", storePass: process.env.SSLCZ_STORE_PASSWORD ?? "" };
};

export const sslczConfigured = () => Boolean(cfg().storeId && cfg().storePass);

export interface SslInit {
  amount: number;
  tranId: string;
  baseUrl: string; // our site, no trailing slash
  customer: { name: string; email: string; phone: string; address: string; city: string };
  productName: string;
  orderCode: string;
}

export async function sslczInit(p: SslInit, f: Fetcher = fetch) {
  const c = cfg();
  const cb = (r: string) => `${p.baseUrl}/api/pay/sslcommerz/${r}`;
  const body = new URLSearchParams({
    store_id: c.storeId,
    store_passwd: c.storePass,
    total_amount: p.amount.toFixed(2),
    currency: "BDT",
    tran_id: p.tranId,
    success_url: cb("success"),
    fail_url: cb("fail"),
    cancel_url: cb("cancel"),
    ipn_url: cb("ipn"),
    cus_name: p.customer.name || "Customer",
    cus_email: p.customer.email || "support@sbd.com.bd",
    cus_phone: p.customer.phone || "01700000000",
    cus_add1: p.customer.address || "Dhaka",
    cus_city: p.customer.city || "Dhaka",
    cus_postcode: "1217",
    cus_country: "Bangladesh",
    shipping_method: "NO",
    product_name: p.productName.slice(0, 250),
    product_category: "general",
    product_profile: "physical-goods",
    value_a: p.orderCode,
  });
  const res = await f(`${c.host}/gwprocess/v4/api.php`, { method: "POST", body, cache: "no-store" });
  const r = (await res.json()) as Record<string, unknown>;
  if (r.status !== "SUCCESS" || !r.GatewayPageURL) {
    throw new Error(`SSLCOMMERZ could not start the payment: ${String(r.failedreason ?? "unknown error")}`);
  }
  return { url: String(r.GatewayPageURL), sessionKey: String(r.sessionkey ?? ""), raw: r };
}

export interface SslValidation { ok: boolean; tranId: string; amount: number; currency: string; bankTranId: string; cardType: string; riskLevel: string; raw: Record<string, unknown> }

/** Order Validation API. ok is true only for status VALID or VALIDATED. */
export async function sslczValidate(valId: string, f: Fetcher = fetch): Promise<SslValidation> {
  const c = cfg();
  const q = new URLSearchParams({ val_id: valId, store_id: c.storeId, store_passwd: c.storePass, format: "json", v: "1" });
  const res = await f(`${c.host}/validator/api/validationserverAPI.php?${q}`, { cache: "no-store" });
  const r = (await res.json()) as Record<string, unknown>;
  return {
    ok: r.status === "VALID" || r.status === "VALIDATED",
    tranId: String(r.tran_id ?? ""),
    // currency_amount / currency_type are what the customer was asked to pay; amount is in BDT.
    amount: Number.parseFloat(String(r.currency_amount ?? r.amount ?? "0")),
    currency: String(r.currency_type ?? r.currency ?? ""),
    bankTranId: String(r.bank_tran_id ?? ""),
    cardType: String(r.card_type ?? ""),
    riskLevel: String(r.risk_level ?? "0"),
    raw: r,
  };
}
