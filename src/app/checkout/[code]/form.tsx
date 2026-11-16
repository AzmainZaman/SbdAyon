"use client";

import { useActionState, useState } from "react";
import { placeOrder, type CheckoutState } from "@/app/actions";

interface Opt { key: string; label: string; desc: string; right?: string; needsAddress?: boolean }

export function CheckoutForm({ code, total, receivingOpts, payOpts, charges, defaults }: {
  code: string; total: number; receivingOpts: Opt[]; payOpts: Opt[]; charges: Record<string, number>; defaults: { name: string; contact: string };
}) {
  const [state, action, pending] = useActionState<CheckoutState, FormData>(placeOrder, {});
  const [recv, setRecv] = useState(receivingOpts[0].key);
  const [pay, setPay] = useState(payOpts[0].key);
  const [agree, setAgree] = useState(false);
  const needsAddress = receivingOpts.find((r) => r.key === recv)?.needsAddress;
  const due = total + (charges[recv] ?? 0);
  const money = `৳${due.toLocaleString("en-US")}`;
  const label = pay === "bank" ? "Place order and see bank details" : pay === "bkash" ? `Pay ${money} with bKash` : `Pay ${money} with SSLCommerz`;
  const isEmail = defaults.contact.includes("@");
  return (
    <form action={action} className="col g24">
      <input type="hidden" name="code" value={code} />
      <section className="col g12">
        <h2 className="d" style={{ fontSize: 20 }}>1 · Contact</h2>
        <div className="grid">
          <div><label className="lbl" htmlFor="name">Full name</label><input id="name" name="name" className="inp" required defaultValue={defaults.name} autoComplete="name" /></div>
          <div><label className="lbl" htmlFor="phone">Phone</label><input id="phone" name="phone" type="tel" className="inp" required placeholder="01XXXXXXXXX" defaultValue={isEmail ? "" : defaults.contact} autoComplete="tel" /></div>
          <div><label className="lbl" htmlFor="email">Email (for invoice, optional)</label><input id="email" name="email" type="email" className="inp" defaultValue={isEmail ? defaults.contact : ""} autoComplete="email" /></div>
        </div>
      </section>
      <section className="col g12">
        <h2 className="d" style={{ fontSize: 20 }}>2 · How do you want to receive it?</h2>
        {receivingOpts.map((o) => (
          <label key={o.key} className="opt">
            <input type="radio" name="receiving" value={o.key} checked={recv === o.key} onChange={() => setRecv(o.key)} />
            <span className="col" style={{ flex: "1 1 auto", gap: 2 }}><span className="b">{o.label}</span><span className="small mut">{o.desc}</span></span>
            <span className="b nowrap">{o.right}</span>
          </label>
        ))}
        {needsAddress ? (
          <div className="grid">
            <div style={{ gridColumn: "1 / -1" }}><label className="lbl" htmlFor="address">Delivery address</label><input id="address" name="address" className="inp" required placeholder="House, road, area" autoComplete="street-address" /></div>
            <div><label className="lbl" htmlFor="district">District</label><input id="district" name="district" className="inp" required autoComplete="address-level2" /></div>
          </div>
        ) : (
          <div className="soft small">Pickup point: 254 New Circular Road, Malibagh, Dhaka 1217. We tell you when your order is ready to collect.</div>
        )}
      </section>
      <section className="col g12">
        <h2 className="d" style={{ fontSize: 20 }}>3 · Payment</h2>
        {payOpts.map((o) => (
          <label key={o.key} className="opt">
            <input type="radio" name="payMethod" value={o.key} checked={pay === o.key} onChange={() => setPay(o.key)} />
            <span className="col" style={{ gap: 2 }}><span className="b">{o.label}</span><span className="small mut">{o.desc}</span></span>
          </label>
        ))}
        {pay === "bank" ? <div className="soft small">After you place the order we show our bank account details. Transfer the exact amount by NPSB, RTGS, bKash to Bank or any other instant method. Your order is confirmed once we verify the payment.</div> : null}
      </section>
      <section className="col g8">
        <h2 className="d" style={{ fontSize: 20 }}><label htmlFor="note">4 · Order note (optional)</label></h2>
        <textarea id="note" name="note" className="inp" maxLength={1000} placeholder="Colour or size choices, gift note, preferred delivery time…" />
      </section>
      <label className="check">
        <input type="checkbox" name="agree" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span>I have read and agree to the <a href="/terms" target="_blank">Terms &amp; Conditions</a> and <a href="/terms#refund" target="_blank">Refund policy</a>.</span>
      </label>
      {state.error ? <div className="notice bad" role="alert">{state.error}</div> : null}
      <div className="col g8">
        <button className="btn-lime" disabled={!agree || pending} style={{ minHeight: 58, fontSize: 16 }}>{pending ? "Please wait…" : label}</button>
        {!agree ? <span className="small mut" style={{ textAlign: "center" }}>Tick the box above to continue.</span> : null}
      </div>
    </form>
  );
}
