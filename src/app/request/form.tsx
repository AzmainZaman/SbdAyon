"use client";

import { useActionState } from "react";
import { requestQuote } from "@/app/actions";

export function RequestForm({ productId, productName, contact }: { productId?: number; productName?: string; contact: string }) {
  const [state, action, pending] = useActionState(requestQuote, {});
  return (
    <form action={action} className="col g16">
      {productId ? <><input type="hidden" name="productId" value={productId} /><div className="soft"><strong>Product:</strong> {productName}</div></> : null}
      <div>
        <label className="lbl" htmlFor="links">{productId ? "More product links (optional)" : "Product links"}</label>
        <textarea id="links" name="links" className="inp" placeholder="One link per line, from any overseas store (up to 10)" />
      </div>
      <div className="grid">
        <div><label className="lbl" htmlFor="name">Your name</label><input id="name" name="name" className="inp" required autoComplete="name" /></div>
        <div><label className="lbl" htmlFor="contact">Mobile number or email</label><input id="contact" name="contact" className="inp" required defaultValue={contact} placeholder="01XXXXXXXXX or you@email.com" /></div>
      </div>
      <div><label className="lbl" htmlFor="note">Note (optional)</label><textarea id="note" name="note" className="inp" maxLength={1000} placeholder="Colour, size, quantity, deadline, or describe a product you have no link for" /></div>
      <div className="sr" aria-hidden="true"><label htmlFor="website">Leave this empty</label><input id="website" name="website" tabIndex={-1} autoComplete="off" /></div>
      {state.error ? <div className="notice bad" role="alert">{state.error}</div> : null}
      <button className="btn-lime" disabled={pending} style={{ minHeight: 56, fontSize: 15 }}>{pending ? "Sending…" : "Send quote request"}</button>
      <span className="small mut">Nothing to pay yet. We reply with a quote link you can accept and pay from.</span>
    </form>
  );
}
