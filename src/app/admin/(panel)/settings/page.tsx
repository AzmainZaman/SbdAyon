import { COUNTRIES } from "@/lib/config";
import { getSettings } from "@/lib/settings";
import { emailConfigured, smsConfigured } from "@/lib/notify";
import { bkashConfigured } from "@/lib/bkash";
import { sslczConfigured } from "@/lib/sslcommerz";
import { saveSettingsAction } from "../../more-actions";

function On({ ok, label }: { ok: boolean; label: string }) {
  return <div className="sb"><span>{label}</span><span className={`tag ${ok ? "lime" : "line"}`}>{ok ? "Connected" : "Not set up"}</span></div>;
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  const s = await getSettings();
  return (
    <form action={saveSettingsAction} className="col g16">
      <div className="sb" style={{ alignItems: "center", flexWrap: "wrap" }}><h1 className="d" style={{ fontSize: 26 }}>Rates &amp; settings</h1><button className="btn-lime">Save changes</button></div>
      {saved ? <div className="notice good" role="status">Saved.</div> : null}
      <section className="col g8">
        <h2 className="b" style={{ fontSize: 17 }}>Countries and rates</h2>
        <span className="small mut">Used by the calculator and shown on the site. A country with no rate shows &quot;ask for a quote&quot; instead of an estimate.</span>
        <div className="tablebox"><table className="t" style={{ minWidth: 860 }}>
          <thead><tr><th>Country</th><th>Currency</th><th>1 unit = ৳</th><th>Sales tax %</th><th>Shipping &amp; duty per kg ৳</th><th>Delivery time</th><th>Next shipment leaves</th><th>Active</th></tr></thead>
          <tbody>
            {COUNTRIES.map((c) => {
              const r = s.countries[c];
              return (
                <tr key={c}>
                  <td className="b">{c}</td>
                  <td><input name={`cur_${c}`} aria-label={`${c} currency`} className="inp sm" style={{ width: 70 }} defaultValue={r.currency} /></td>
                  <td><input name={`rate_${c}`} aria-label={`${c} exchange rate`} className="inp sm" style={{ width: 90 }} defaultValue={r.rate || ""} /></td>
                  <td><input name={`tax_${c}`} aria-label={`${c} tax percent`} className="inp sm" style={{ width: 70 }} defaultValue={r.taxPct} /></td>
                  <td><input name={`ship_${c}`} aria-label={`${c} shipping per kg`} className="inp sm" style={{ width: 110 }} defaultValue={r.shipPerKg || ""} /></td>
                  <td><input name={`days_${c}`} aria-label={`${c} delivery time`} className="inp sm" style={{ width: 120 }} defaultValue={r.days} placeholder="e.g. 15–20 days" /></td>
                  <td><input name={`next_${c}`} aria-label={`${c} next shipment`} className="inp sm" style={{ width: 130 }} defaultValue={r.nextShipment} placeholder="e.g. 5 December" /></td>
                  <td><input type="checkbox" name={`active_${c}`} aria-label={`${c} active`} defaultChecked={r.active} style={{ width: 20, height: 20, accentColor: "var(--ink)" }} /></td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
      </section>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(340px, 100%), 1fr))", alignItems: "start" }}>
        <section className="card col g12">
          <span className="b">Charges</span>
          <div><label className="lbl" htmlFor="servicePct">Service charge %</label><input id="servicePct" name="servicePct" className="inp sm" defaultValue={s.servicePct} /></div>
          <div><label className="lbl" htmlFor="deliveryInside">Home delivery inside Dhaka ৳</label><input id="deliveryInside" name="deliveryInside" className="inp sm" defaultValue={s.deliveryInside || ""} /></div>
          <div><label className="lbl" htmlFor="deliveryOutside">Courier outside Dhaka ৳</label><input id="deliveryOutside" name="deliveryOutside" className="inp sm" defaultValue={s.deliveryOutside || ""} /></div>
          <span className="small mut">Pickup from Malibagh is always free.</span>
        </section>
        <section className="card col g12">
          <span className="b">Quotes</span>
          <div><label className="lbl" htmlFor="quoteValidDays">New quotes are valid for (days)</label><input id="quoteValidDays" name="quoteValidDays" className="inp sm" defaultValue={s.quoteValidDays} /></div>
          <div><label className="lbl" htmlFor="quoteTerms">Default terms on new quotes and invoices</label><textarea id="quoteTerms" name="quoteTerms" className="inp" defaultValue={s.quoteTerms} /></div>
          <div><label className="lbl" htmlFor="hours">Opening hours (shown on the help page)</label><input id="hours" name="hours" className="inp sm" defaultValue={s.hours} /></div>
        </section>
        <section className="card col g12">
          <span className="b">Connections</span>
          <On ok={bkashConfigured()} label="bKash" />
          <On ok={sslczConfigured()} label="SSLCommerz" />
          <On ok={emailConfigured()} label="Email (Google Workspace)" />
          <On ok={smsConfigured()} label="SMS gateway" />
          <span className="small mut">These are switched on from the hosting settings, not here. Bank transfer always works.</span>
        </section>
      </div>
      <section className="card col g12">
        <span className="b">Terms &amp; Conditions page</span>
        <label className="sr" htmlFor="termsPage">Terms and Conditions</label><textarea id="termsPage" name="termsPage" className="inp" style={{ minHeight: 180 }} defaultValue={s.termsPage} placeholder="Paste your Terms & Conditions. Leave a blank line between paragraphs." />
        <span className="b">Refund policy</span>
        <label className="sr" htmlFor="refundPage">Refund policy</label><textarea id="refundPage" name="refundPage" className="inp" style={{ minHeight: 120 }} defaultValue={s.refundPage} />
      </section>
      <button className="btn-lime" style={{ alignSelf: "flex-start" }}>Save changes</button>
    </form>
  );
}
