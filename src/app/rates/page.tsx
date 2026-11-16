import type { Metadata } from "next";
import { Shell } from "@/components/site";
import { COUNTRIES, SITE } from "@/lib/config";
import { taka } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { Calculator } from "./calc";

export const metadata: Metadata = { title: "Delivery times and cost calculator" };
export const dynamic = "force-dynamic";

export default async function Rates() {
  const s = await getSettings();
  const active = COUNTRIES.filter((c) => s.countries[c].active);
  return (
    <Shell>
      <div className="split">
        <div className="side col g16">
          <h1 className="d" style={{ fontSize: "clamp(30px, 4vw, 46px)" }}>Know the price and the date first.</h1>
          <p className="mut" style={{ fontSize: 17, maxWidth: 460 }}>Every quote lists each charge in taka. The final price is confirmed by SBD before you pay.</p>
          <div className="soft col g8" style={{ fontSize: 14, maxWidth: 460 }}>
            <span className="b">What your total includes</span>
            <span>Product price, converted to taka</span><span>Sales tax charged by the store&apos;s country</span><span>SBD service charge ({s.servicePct}%)</span><span>International shipping and Bangladesh import duty</span><span>Delivery inside Bangladesh, chosen at checkout</span>
          </div>
        </div>
        <div className="side"><Calculator book={{ countries: Object.fromEntries(active.map((c) => [c, s.countries[c]])), servicePct: s.servicePct }} /></div>
      </div>
      <section className="col g16">
        <h2 className="d" style={{ fontSize: 26 }}>Delivery times by country</h2>
        <div className="tablebox"><table className="t" style={{ minWidth: 560 }}>
          <thead><tr><th>From</th><th>Typical delivery</th><th>Sales tax</th><th>Shipping &amp; duty</th><th>Next shipment leaves</th></tr></thead>
          <tbody>{active.map((c) => { const r = s.countries[c]; return <tr key={c}><td className="b">{c}</td><td>{r.days || "On request"}</td><td>{r.taxPct ? `${r.taxPct}%` : "—"}</td><td>{r.shipPerKg ? `${taka(r.shipPerKg)} per kg` : "In your quote"}</td><td>{r.nextShipment || "Ask us"}</td></tr>; })}</tbody>
        </table></div>
      </section>
      <section className="col g16">
        <h2 className="d" style={{ fontSize: 26 }}>Getting it to you in Bangladesh</h2>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))" }}>
          <div className="card col g8"><span className="b" style={{ fontSize: 17 }}>Pickup</span><span className="small mut">Collect from {SITE.address}. We tell you when it is ready.</span><span className="b">Free</span></div>
          <div className="card col g8"><span className="b" style={{ fontSize: 17 }}>Inside Dhaka</span><span className="small mut">Home delivery after your order arrives in Dhaka.</span><span className="b">{s.deliveryInside ? taka(s.deliveryInside) : "Shown at checkout"}</span></div>
          <div className="card col g8"><span className="b" style={{ fontSize: 17 }}>Outside Dhaka</span><span className="small mut">Courier delivery after your order arrives in Dhaka.</span><span className="b">{s.deliveryOutside ? taka(s.deliveryOutside) : "Shown at checkout"}</span></div>
        </div>
      </section>
    </Shell>
  );
}
