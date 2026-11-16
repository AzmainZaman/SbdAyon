/* eslint-disable @next/next/no-img-element */
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/copy";
import { COUNTRIES } from "@/lib/config";
import { taka, takaInWords } from "@/lib/money";
import { baseUrl } from "@/lib/pay";
import { getQuote, quoteTotals } from "@/lib/store";
import { RECEIVING } from "@/lib/config";
import { saveQuoteAction } from "../../../actions";
import { convertQuote, fetchIntoQuote } from "../../../more-actions";

const LABEL: Record<string, string> = { request: "New request", draft: "Draft", sent: "Sent", changes_requested: "Changes requested", accepted: "Accepted", expired: "Expired", cancelled: "Cancelled" };
const SOURCES = ["Facebook", "WhatsApp", "Instagram", "Phone call", "Walk-in", "Website"];

export default async function QuoteBuilder({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ shared?: string; fetch?: string }> }) {
  const { id } = await params;
  const { shared, fetch: fetched } = await searchParams;
  const found = await getQuote({ id: Number(id) });
  if (!found) notFound();
  const { quote: q, lines } = found;
  const t = quoteTotals(q, lines);
  const link = `${await baseUrl()}/q/${q.code}`;
  const locked = q.status === "accepted";
  const share = encodeURIComponent(`Your SBD Global Shopping quote ${q.number} is ready: ${link}`);
  return (
    <>
    <form action={fetchIntoQuote.bind(null, q.id)} className="card col g8" style={{ padding: 16 }}>
      <label className="lbl" htmlFor="link" style={{ margin: 0 }}>Add item by link</label>
      <div className="row g8"><input id="link" name="link" type="url" required className="inp sm" style={{ flex: "1 1 260px", width: "auto" }} placeholder="Paste product link — name, photo and price fill in where the store allows it" /><button className="btn" style={{ minHeight: 44 }}>Fetch</button></div>
      {fetched === "partial" ? <span className="small" role="status">The store did not allow automatic reading. The link was added; fill in the name and price below.</span> : null}
      {fetched === "bad" ? <span className="small" role="alert">That does not look like a web link.</span> : null}
      <span className="small mut">Save your other changes first: fetching reloads this page.</span>
    </form>
    <form action={saveQuoteAction.bind(null, q.id)} className="col g16">
      {/* Pressing Enter in any field saves, instead of triggering the first line button. */}
      <button name="intent" value="save" className="sr" tabIndex={-1} aria-hidden="true">Save</button>
      <div className="row g12">
        <h1 className="d" style={{ fontSize: 26 }}>Quote {q.number}</h1>
        <span className={`tag ${q.status === "draft" ? "line" : "lime"}`}>{LABEL[q.status] ?? q.status}</span>
        {q.viewedAt ? <span className="small mut">Opened by customer</span> : null}
      </div>
      {q.status === "changes_requested" && q.changeRequest ? <div className="notice good"><strong>Customer asked for changes:</strong> {q.changeRequest}</div> : null}
      {locked ? <div className="notice">This quote was accepted and became an order. Editing it will not change that order.</div> : null}
      <div className="split" style={{ gap: 20 }}>
        <div className="main col g16">
          <div className="card col g12" style={{ padding: 16 }}>
            <span className="lbl" style={{ margin: 0 }}>Customer</span>
            <div className="grid">
              <div><label className="sr" htmlFor="customerName">Customer name</label><input id="customerName" name="customerName" className="inp sm" placeholder="Customer name" defaultValue={q.customerName} /></div>
              <div><label className="sr" htmlFor="customerContact">Phone or email</label><input id="customerContact" name="customerContact" className="inp sm" placeholder="Phone or email (optional)" defaultValue={q.customerContact} /></div>
              <div><label className="sr" htmlFor="source">Came from</label><select id="source" name="source" className="inp sm" defaultValue={q.source}>{SOURCES.map((x) => <option key={x}>{x}</option>)}</select></div>
              <div><label className="sr" htmlFor="country">Shipping from</label><select id="country" name="country" className="inp sm" defaultValue={q.country}>{COUNTRIES.map((x) => <option key={x}>{x}</option>)}</select></div>
            </div>
          </div>

          <div className="card" style={{ padding: 0 }}>
            {lines.length === 0 ? <div className="line mut">No lines yet. Use the buttons below to add the first item.</div> : null}
            {lines.map((l, i) => (
              <div key={l.id} className="line">
                <input type="hidden" name="kind" value={l.kind} />
                <button className="sbtn" name="intent" value={`up:${i}`} aria-label="Move line up" style={{ minHeight: 40, padding: "0 10px" }} disabled={i === 0}>↑</button>
                {l.kind === "item" ? (
                  <>
                    {l.imageUrl ? <img className="thumb" src={l.imageUrl} alt="" style={{ width: 44, height: 44 }} /> : <div className="thumb" aria-hidden="true" style={{ width: 44, height: 44 }} />}
                    <input name="name" aria-label="Product name" className="inp sm b" style={{ flex: "999 1 220px", width: "auto" }} placeholder="Product name" defaultValue={l.name} />
                    <input name="website" aria-label="Website" className="inp sm" style={{ flex: "1 1 90px", width: 90 }} placeholder="Website" defaultValue={l.website} />
                    <input name="qty" aria-label="Quantity" className="inp sm" style={{ flex: "0 0 56px", width: 56, textAlign: "center" }} inputMode="numeric" defaultValue={l.qty} />
                    <input name="price" aria-label="Price in taka" className="inp sm b r" style={{ flex: "0 0 96px", width: 96 }} inputMode="numeric" placeholder="৳" defaultValue={l.price || ""} />
                    <input name="url" aria-label="Product link" className="inp sm" style={{ flex: "1 1 260px", width: "auto" }} placeholder="Product link (https://…)" defaultValue={l.url} />
                    <input name="imageUrl" aria-label="Image link" className="inp sm" style={{ flex: "1 1 260px", width: "auto" }} placeholder="Image link (https://…)" defaultValue={l.imageUrl} />
                  </>
                ) : (
                  <>
                    <span className={`tag ${l.kind === "heading" ? "lime" : ""}`}>{l.kind === "text" ? "Text" : l.kind === "heading" ? "Heading" : "Charge"}</span>
                    <input name="name" aria-label={l.kind === "charge" ? "Charge name" : "Text"} className={`inp sm ${l.kind === "heading" ? "b" : ""}`} style={{ flex: "999 1 220px", width: "auto" }} defaultValue={l.name}
                      placeholder={l.kind === "text" ? "Any text to show on the quote: warranty, colour, condition…" : l.kind === "heading" ? "Section heading, for example: From Amazon USA" : "Charge or discount name"} />
                    <input type="hidden" name="website" value="" /><input type="hidden" name="qty" value="1" /><input type="hidden" name="url" value="" /><input type="hidden" name="imageUrl" value="" />
                    {l.kind === "charge" ? <input name="price" aria-label="Amount in taka, minus for a discount" className="inp sm b r" style={{ flex: "0 0 110px", width: 110 }} placeholder="৳ (−for discount)" defaultValue={l.price || ""} /> : <input type="hidden" name="price" value="0" />}
                  </>
                )}
                <button className="sbtn" name="intent" value={`del:${i}`} aria-label="Remove line" style={{ minHeight: 40, padding: "0 12px" }}>×</button>
              </div>
            ))}
            <div className="row g8" style={{ padding: "12px 14px" }}>
              <span className="small b">Insert:</span>
              <button className="sbtn" name="intent" value="add:item">+ Item</button>
              <button className="sbtn" name="intent" value="add:text">+ Text line</button>
              <button className="sbtn" name="intent" value="add:heading">+ Section heading</button>
              <button className="sbtn" name="intent" value="add:charge">+ Charge or discount line</button>
            </div>
          </div>

          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))" }}>
            <div className="card" style={{ padding: 16 }}><label className="lbl" htmlFor="noteCustomer">Note to customer</label><textarea id="noteCustomer" name="noteCustomer" className="inp" defaultValue={q.noteCustomer} placeholder="Shown on the quote" /></div>
            <div className="card" style={{ padding: 16 }}><label className="lbl" htmlFor="noteInternal">Internal note</label><textarea id="noteInternal" name="noteInternal" className="inp" defaultValue={q.noteInternal} placeholder="Only staff can see this" /></div>
            <div className="card" style={{ padding: 16, gridColumn: "1 / -1" }}><label className="lbl" htmlFor="terms">Terms shown at the bottom of this quote</label><textarea id="terms" name="terms" className="inp" defaultValue={q.terms} /></div>
          </div>
        </div>

        <aside className="side col g16">
          <div className="card col g12" style={{ fontSize: 14 }}>
            <div className="sb"><span>Items ({t.itemCount})</span><span>{taka(t.items)}</span></div>
            <div className="sb" style={{ alignItems: "center" }}><label htmlFor="taxPct">Sales tax %</label><span className="row g8"><input id="taxPct" name="taxPct" className="inp sm r" style={{ width: 64 }} defaultValue={Number(q.taxPct)} />{taka(t.tax)}</span></div>
            <div className="sb b"><span>Subtotal</span><span>{taka(t.subtotal)}</span></div>
            <div className="sb" style={{ alignItems: "center" }}><label htmlFor="servicePct">Service charge %</label><span className="row g8"><input id="servicePct" name="servicePct" className="inp sm r" style={{ width: 64 }} defaultValue={Number(q.servicePct)} />{taka(t.service)}</span></div>
            <div className="sb" style={{ alignItems: "center" }}><label htmlFor="shipping">Shipping &amp; import duty</label><input id="shipping" name="shipping" className="inp sm r" style={{ width: 110 }} defaultValue={q.shipping || ""} placeholder="৳" /></div>
            {t.extras !== 0 ? <div className="sb"><span>Extra charge lines</span><span>{taka(t.extras)}</span></div> : null}
            <div className="sb" style={{ alignItems: "center" }}><label htmlFor="discount">Discount</label><input id="discount" name="discount" className="inp sm r" style={{ width: 110 }} defaultValue={q.discount || ""} placeholder="৳" /></div>
            <div className="sb" style={{ alignItems: "baseline", paddingTop: 12, borderTop: "1px solid var(--line)" }}><span className="b">Grand total</span><span className="d" style={{ fontSize: 26 }}>{taka(t.total)}</span></div>
            <span className="small mut">{takaInWords(t.total)}</span>
            <span className="small mut">Totals update each time you save.</span>
          </div>
          <div className="card col g12" style={{ fontSize: 14 }}>
            <div><label className="lbl" htmlFor="eta">Estimated delivery (shown to customer)</label><input id="eta" name="eta" className="inp sm" defaultValue={q.eta} placeholder="For example: 10–17 December" /></div>
            <div><label className="lbl" htmlFor="validUntil">Valid until</label><input id="validUntil" name="validUntil" type="date" className="inp sm" defaultValue={q.validUntil} /></div>
          </div>
          <button className="btn" name="intent" value="save">Save</button>
          <button className="btn-lime" name="intent" value="send" style={{ minHeight: 52 }}>{q.status === "draft" ? "Save and make link live" : "Save and keep link live"}</button>
          {q.status === "draft" ? (
            <span className="small mut">The customer link only works after you make it live.</span>
          ) : (
            <div className="card col g12" style={{ fontSize: 14 }}>
              <span className="b">{shared ? "Link is live — share it" : "Share this quote"}</span>
              <div className="row g8" style={{ flexWrap: "nowrap" }}><input readOnly aria-label="Quote link" className="inp sm b" value={link} /><CopyButton text={link} /></div>
              <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                <a className="sbtn" href={`https://wa.me/?text=${share}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
                <a className="sbtn" href={`sms:?&body=${share}`}>SMS</a>
                <a className="sbtn" href={`mailto:?subject=${encodeURIComponent(`Your SBD quote ${q.number}`)}&body=${share}`}>Email</a>
                <a className="sbtn" href={link} target="_blank" rel="noopener noreferrer">Preview</a>
              </div>
              <span className="small mut">Anyone with the link can view the quote, accept it and go to checkout. No login needed.</span>
            </div>
          )}
          <button className="sbtn" name="intent" value="cancel">Cancel this quote</button>
        </aside>
      </div>
    </form>
    {!locked ? (
      <details className="card">
        <summary className="b" style={{ cursor: "pointer", minHeight: 28 }}>Create the order yourself (phone, Facebook or walk-in customer)</summary>
        <form action={convertQuote.bind(null, q.id)} className="col g12" style={{ paddingTop: 12 }}>
          <span className="small mut">Uses the saved quote above. The customer does not need to open the link.</span>
          <div className="grid">
            <div><label className="lbl" htmlFor="cname">Customer name</label><input id="cname" name="name" className="inp sm" required defaultValue={q.customerName} /></div>
            <div><label className="lbl" htmlFor="cphone">Phone</label><input id="cphone" name="phone" className="inp sm" required /></div>
            <div><label className="lbl" htmlFor="cemail">Email (optional)</label><input id="cemail" name="email" type="email" className="inp sm" /></div>
            <div><label className="lbl" htmlFor="crecv">Receiving</label><select id="crecv" name="receiving" className="inp sm">{RECEIVING.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}</select></div>
            <div><label className="lbl" htmlFor="caddr">Address (for delivery)</label><input id="caddr" name="address" className="inp sm" /></div>
            <div><label className="lbl" htmlFor="cdist">District</label><input id="cdist" name="district" className="inp sm" /></div>
            <div><label className="lbl" htmlFor="cpaid">Amount already paid (leave empty if unpaid)</label><input id="cpaid" name="paid" className="inp sm" placeholder="৳" /></div>
            <div><label className="lbl" htmlFor="cref">Payment reference</label><input id="cref" name="payRef" className="inp sm" placeholder="Cash, bKash TrxID, bank…" /></div>
          </div>
          <div><label className="lbl" htmlFor="cnote">Order note</label><input id="cnote" name="note" className="inp sm" /></div>
          <span className="small mut">If unpaid, the order page link lets the customer pay by bKash, card or bank transfer.</span>
          <button className="btn" style={{ alignSelf: "flex-start" }}>Create order</button>
        </form>
      </details>
    ) : null}
    </>
  );
}
