import { describe, expect, it } from "vitest";
import { createOrderFromQuote, createQuote, getOrder, getQuote, markPayment, quoteTotals, saveQuote, settlePayment } from "@/lib/store";
import { bkashCreate, bkashExecute } from "@/lib/bkash";
import { sslczValidate } from "@/lib/sslcommerz";

const line = (name: string, price: number) => ({ kind: "item" as const, name, website: "Amazon", url: "", imageUrl: "", qty: 1, price });

describe("quote to paid order", () => {
  it("creates a quote, turns it into an order and settles the payment only once", async () => {
    const q = await createQuote({ customerName: "Test Customer" });
    expect(q.number).toMatch(/^Q-\d+$/);
    await saveQuote(q.id, { shipping: 6600, discount: 510, status: "sent", eta: "1-7 Dec" }, [
      line("Rubber Stamp", 1399), line("Corner Punch", 1259),
      { kind: "text", name: "Colour: pink", website: "", url: "", imageUrl: "", qty: 1, price: 0 },
    ]);
    const loaded = await getQuote({ code: q.code });
    expect(loaded?.lines.map((l) => l.kind)).toEqual(["item", "item", "text"]);
    const totals = quoteTotals(loaded!.quote, loaded!.lines);
    expect(totals.items).toBe(2658);

    const { order, payment } = await createOrderFromQuote(loaded!.quote, loaded!.lines, {
      name: "Test Customer", phone: "01700000000", email: "", receiving: "pickup", address: "ignored for pickup", district: "", note: "gift", payMethod: "bkash",
    });
    expect(order.number).toMatch(/^SBD-\d+$/);
    expect(order.total).toBe(totals.total);
    expect(order.address).toBe("");
    expect(order.stage).toBe("awaiting_payment");
    expect((await getQuote({ id: q.id }))?.quote.status).toBe("accepted");

    expect(await settlePayment(payment.id, { trxId: "TRX1" })).toBe(true);
    expect(await settlePayment(payment.id, { trxId: "TRX1" })).toBe(false); // IPN arriving after the redirect
    await markPayment(payment.id, "failed"); // a late failure notice must not undo a paid payment
    const after = await getOrder({ code: order.code });
    expect(after?.order.paid).toBe(order.total);
    expect(after?.order.stage).toBe("confirmed");
    expect(after?.payments[0].status).toBe("paid");
    expect(after?.events.map((e) => e.stage)).toEqual(["awaiting_payment", "confirmed"]);
  });
});

describe("bKash client", () => {
  it("reuses the token, creates and executes a payment", async () => {
    process.env.BKASH_USERNAME = "u"; process.env.BKASH_PASSWORD = "p"; process.env.BKASH_APP_KEY = "k"; process.env.BKASH_APP_SECRET = "s";
    const calls: string[] = [];
    const fake = (async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url); calls.push(u.split("/tokenized/checkout/")[1]);
      const body = JSON.parse(String(init?.body ?? "{}"));
      const headers = init?.headers as Record<string, string>;
      let json: Record<string, unknown> = {};
      if (u.endsWith("/token/grant")) { expect(headers.username).toBe("u"); json = { statusCode: "0000", id_token: "TOKEN", refresh_token: "R", expires_in: 3600 }; }
      else if (u.endsWith("/create")) { expect(headers.authorization).toBe("TOKEN"); expect(body.mode).toBe("0011"); expect(body.amount).toBe("19500.00"); json = { statusCode: "0000", paymentID: "PID1", bkashURL: "https://pay/1" }; }
      else if (u.endsWith("/execute")) json = { statusCode: "0000", transactionStatus: "Completed", trxID: "TX9", amount: "19500.00" };
      return new Response(JSON.stringify(json));
    }) as typeof fetch;
    const c = await bkashCreate({ amount: 19500, invoice: "SBD-1", payerReference: "017", callbackURL: "https://x/cb" }, fake);
    expect(c.bkashURL).toBe("https://pay/1");
    const e = await bkashExecute("PID1", fake);
    expect(e).toMatchObject({ ok: true, trxID: "TX9", amount: 19500 });
    expect(calls).toEqual(["token/grant", "create", "execute"]); // one token for both calls
  });
  it("treats anything but 0000 + Completed as not paid", async () => {
    const fake = (async () => new Response(JSON.stringify({ statusCode: "2023", statusMessage: "Insufficient Balance" }))) as typeof fetch;
    expect((await bkashExecute("PID2", fake)).ok).toBe(false);
  });
});

describe("SSLCOMMERZ validation", () => {
  it("accepts VALID and rejects everything else", async () => {
    const mk = (status: string) => (async () => new Response(JSON.stringify({ status, tran_id: "T1", amount: "19500.00", currency_amount: "19500.00", currency_type: "BDT", bank_tran_id: "B1" }))) as typeof fetch;
    expect(await sslczValidate("v", mk("VALID"))).toMatchObject({ ok: true, tranId: "T1", amount: 19500, currency: "BDT" });
    expect((await sslczValidate("v", mk("INVALID_TRANSACTION"))).ok).toBe(false);
  });
});

import { parseCsv } from "@/lib/csv";
import { assertPublicUrl, parseProduct } from "@/lib/fetchlink";
import { normalizeContact } from "@/lib/session";
import { defaultSettings, estimate } from "@/lib/settings";

describe("helpers", () => {
  it("reads CSV with quotes, commas and line breaks", () => {
    const rows = parseCsv('Name,Note\r\n"Rahim, A","line1\nline2"\n#1002,"say ""hi"""\n');
    expect(rows).toEqual([{ Name: "Rahim, A", Note: "line1\nline2" }, { Name: "#1002", Note: 'say "hi"' }]);
  });
  it("refuses private and odd addresses for link fetching", async () => {
    for (const bad of ["http://127.0.0.1/x", "http://10.0.0.5/", "http://169.254.169.254/latest", "http://[::1]/", "ftp://example.com/", "http://user:pw@93.184.216.34/", "file:///etc/passwd"]) {
      await expect(assertPublicUrl(bad)).rejects.toThrow();
    }
    await expect(assertPublicUrl("https://93.184.216.34/item")).resolves.toBeInstanceOf(URL);
  });
  it("reads product details from page tags", () => {
    const html = '<html><head><title>Fallback</title><meta property="og:title" content="Paper Cutter &amp; Ruler"><meta property="og:image" content="/img/a.jpg"><meta property="product:price:amount" content="12.99"><meta property="product:price:currency" content="USD"></head></html>';
    expect(parseProduct(html, new URL("https://www.shop.example.com/p/1"))).toMatchObject({ name: "Paper Cutter & Ruler", imageUrl: "https://www.shop.example.com/img/a.jpg", price: 12.99, currency: "USD", ok: true });
    expect(parseProduct('<meta property="og:image" content="javascript:alert(1)"><title>X</title>', new URL("https://a.example/")).imageUrl).toBe("");
  });
  it("normalises phones and emails", () => {
    expect(normalizeContact("+880 1711-111111")).toBe("01711111111");
    expect(normalizeContact(" Me@Example.COM ")).toBe("me@example.com");
    expect(normalizeContact("12345")).toBe("");
  });
  it("estimates a landed cost only when the rate is set", () => {
    const s = defaultSettings();
    expect(estimate(s, "USA", 100, 1)).toBeNull();
    s.countries.USA = { ...s.countries.USA, rate: 120, shipPerKg: 1500 };
    expect(estimate(s, "USA", 100, 2)).toMatchObject({ items: 12000, tax: 1080, service: 1308, shipping: 3000, total: 17388 });
  });
});
