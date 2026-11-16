"use client";

import Link from "next/link";
import { useState } from "react";
import { estimate, type RateBook } from "@/lib/estimate";

const tk = (n: number) => `৳${n.toLocaleString("en-US")}`;

export function Calculator({ book }: { book: RateBook }) {
  const list = Object.keys(book.countries).filter((c) => book.countries[c].active);
  const [country, setCountry] = useState(list[0] ?? "USA");
  const [price, setPrice] = useState("100");
  const [weight, setWeight] = useState("1");
  const c = book.countries[country];
  const e = estimate(book, country, Number.parseFloat(price) || 0, Number.parseFloat(weight) || 0);
  return (
    <div className="col g16" style={{ padding: 28, borderRadius: 24, border: "2px solid var(--ink)" }}>
      <h2 className="d" style={{ fontSize: 20 }}>Cost calculator</h2>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(150px, 100%), 1fr))" }}>
        <div><label className="lbl" htmlFor="c-from">Shipping from</label><select id="c-from" className="inp" value={country} onChange={(ev) => setCountry(ev.target.value)}>{list.map((x) => <option key={x}>{x}</option>)}</select></div>
        <div><label className="lbl" htmlFor="c-price">Product price ({c?.currency})</label><input id="c-price" className="inp" inputMode="decimal" value={price} onChange={(ev) => setPrice(ev.target.value)} /></div>
        <div><label className="lbl" htmlFor="c-w">Weight (kg)</label><input id="c-w" className="inp" inputMode="decimal" value={weight} onChange={(ev) => setWeight(ev.target.value)} /></div>
      </div>
      {e ? (
        <div className="soft col g8" style={{ fontSize: 14, borderRadius: 12 }} aria-live="polite">
          <div className="sb"><span className="mut">Product price</span><span>{tk(e.items)}</span></div>
          {e.tax ? <div className="sb"><span className="mut">{country} sales tax ({e.taxPct}%)</span><span>{tk(e.tax)}</span></div> : null}
          <div className="sb"><span className="mut">Service charge ({book.servicePct}%)</span><span>{tk(e.service)}</span></div>
          <div className="sb"><span className="mut">Shipping &amp; import duty</span><span>{c.shipPerKg ? tk(e.shipping) : "in your quote"}</span></div>
          <div className="sb" style={{ paddingTop: 12, borderTop: "1px solid #D5D8CC", fontSize: 17, fontWeight: 700 }}><span>Estimated total</span><span>{tk(e.total)}</span></div>
        </div>
      ) : (
        <div className="notice" aria-live="polite">We quote {country} orders individually. Send us the link and we will reply with the exact price.</div>
      )}
      {c?.days ? <div className="sb" style={{ alignItems: "center", padding: "14px 16px", borderRadius: 12, background: "var(--lime)", fontSize: 14 }}><span className="b">Estimated delivery</span><span className="b">about {c.days}</span></div> : null}
      <Link className="btn" href="/request" style={{ minHeight: 54 }}>Request a quote</Link>
      <span className="small mut">An estimate only. Your quote from SBD is the final price.</span>
    </div>
  );
}
