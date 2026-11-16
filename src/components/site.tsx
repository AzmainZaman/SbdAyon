/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { SITE, COUNTRIES, stageLabel, STAGES } from "@/lib/config";
import { taka, takaInWords, type Totals } from "@/lib/money";

export function Header() {
  return (
    <header className="site-header">
      <div className="wrap row g24" style={{ paddingTop: 18, paddingBottom: 18, justifyContent: "space-between" }}>
        <Link href="/" style={{ display: "flex" }}><img src="/sbd-logo.png" alt="SBD Global Shopping home" style={{ height: 30, width: "auto" }} /></Link>
        <nav className="row g24" style={{ fontSize: 14, fontWeight: 600 }}>
          <Link href="/track" style={{ textDecoration: "none", padding: "12px 0" }}>Track order</Link>
          <Link href="/rates" style={{ textDecoration: "none", padding: "12px 0" }}>Delivery &amp; rates</Link>
          <Link href="/account" style={{ textDecoration: "none", padding: "12px 0" }}>My account</Link>
          <Link href="/request" style={{ textDecoration: "none", padding: "12px 18px", borderRadius: 999, background: "var(--lime)" }}>Request a quote</Link>
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap grid" style={{ paddingTop: 40, paddingBottom: 24, gap: 32 }}>
        <div className="col g12">
          <img src="/sbd-global-shopping.png" alt="SBD Global Shopping" style={{ height: 56, width: "auto", alignSelf: "flex-start" }} />
          <span>{SITE.address}</span>
          <span>{SITE.phone}<br />{SITE.emailInfo}<br />{SITE.emailSupport}</span>
        </div>
        <div className="col g8"><span className="b">We bring from</span>{COUNTRIES.map((c) => <span key={c}>{c}</span>)}</div>
        <div className="col g8">
          <span className="b">Help</span>
          <Link href="/help">How it works &amp; FAQ</Link>
          <Link href="/rates">Delivery times &amp; calculator</Link>
          <Link href="/track">Track order</Link>
          <Link href="/terms">Terms &amp; Conditions</Link>
          <Link href="/terms#refund">Refund policy</Link>
        </div>
        <div className="col g8">
          <span className="b">Follow {SITE.social}</span>
          <a href="https://facebook.com/sbdshopping">Facebook</a>
          <a href="https://instagram.com/sbdshopping">Instagram</a>
          <span className="b" style={{ paddingTop: 8 }}>We accept</span>
          <span>bKash · SSLCommerz · Bank transfer</span>
        </div>
      </div>
    </footer>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (<><Header /><main className="wrap col g24" style={{ paddingTop: 28, paddingBottom: 24 }}>{children}</main><Footer /></>);
}

export interface ViewLine { id: number; kind: string; name: string; website: string; url: string; imageUrl: string; qty: number; price: number; serials?: string }

export function LinesTable({ lines, showSerials = false }: { lines: ViewLine[]; showSerials?: boolean }) {
  const numbers = new Map<number, number>();
  lines.filter((l) => l.kind === "item").forEach((l, i) => numbers.set(l.id, i + 1));
  return (
    <div className="tablebox">
      <table className="t" style={{ minWidth: 560 }}>
        <thead><tr><th>#</th><th>Photo</th><th>Product</th><th>Website</th><th>Qty</th><th className="r">Price</th></tr></thead>
        <tbody>
          {lines.map((l) => {
            if (l.kind === "heading") return <tr key={l.id}><td colSpan={6} className="b" style={{ background: "var(--lime)" }}>{l.name}</td></tr>;
            if (l.kind === "text") return <tr key={l.id}><td colSpan={6} className="small" style={{ background: "var(--soft)" }}>{l.name}</td></tr>;
            if (l.kind === "charge") return null;
            return (
              <tr key={l.id}>
                <td className="mut">{numbers.get(l.id)}</td>
                <td>{l.imageUrl ? <img className="thumb" src={l.imageUrl} alt="" /> : <div className="thumb" aria-hidden="true" />}</td>
                <td className="b">
                  {l.url ? <a href={l.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>{l.name}</a> : l.name}
                  {showSerials && l.serials ? <span className="small mut" style={{ display: "block", fontWeight: 400 }}>Serial no. {l.serials}</span> : null}
                </td>
                <td>{l.website}</td>
                <td>{l.qty}</td>
                <td className="r b nowrap">{taka(l.price * l.qty)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return <div className="sb" style={strong ? { fontWeight: 600 } : undefined}><span className={strong ? undefined : "mut"}>{k}</span><span>{v}</span></div>;
}

export function TotalsBox({ t, taxPct, servicePct, charges, country, children }: { t: Totals; taxPct: number; servicePct: number; charges: ViewLine[]; country: string; children?: React.ReactNode }) {
  return (
    <div className="card col g12" style={{ fontSize: 14 }}>
      <Row k={`Items (${t.itemCount})`} v={taka(t.items)} />
      {t.tax > 0 && <Row k={`${country} sales tax (${taxPct}%)`} v={taka(t.tax)} />}
      <Row k="Subtotal" v={taka(t.subtotal)} strong />
      {t.service > 0 && <Row k={`Service charge (${servicePct}%)`} v={taka(t.service)} />}
      {t.shipping > 0 && <Row k="Shipping & import duty" v={taka(t.shipping)} />}
      {charges.map((c) => <Row key={c.id} k={c.name || "Other charge"} v={taka(c.price)} />)}
      {t.discount > 0 && <div className="sb" style={{ color: "var(--green)", fontWeight: 600 }}><span>Discount</span><span>{taka(-t.discount)}</span></div>}
      {t.delivery > 0 && <Row k="Delivery in Bangladesh" v={taka(t.delivery)} />}
      <div className="sb" style={{ alignItems: "baseline", paddingTop: 12, borderTop: "1px solid var(--line)" }}>
        <span className="b">Grand total</span><span className="d" style={{ fontSize: 28 }}>{taka(t.total)}</span>
      </div>
      <span className="small mut">In words: {takaInWords(t.total)}</span>
      {children}
    </div>
  );
}

export function Eta({ eta, note }: { eta: string; note?: string }) {
  return (
    <div className="limebox col" style={{ gap: 4 }}>
      <span className="small b">Estimated delivery</span>
      <span style={{ fontSize: 20, fontWeight: 700 }}>{eta || "To be confirmed by SBD"}</span>
      {note ? <span className="small">{note}</span> : null}
    </div>
  );
}

export function Tracker({ stage, events }: { stage: string; events: { stage: string | null; at: Date }[] }) {
  const tracked = STAGES.filter((s) => s.tracked);
  const current = tracked.findIndex((s) => s.key === stage);
  const dateOf = (key: string) => {
    const e = events.find((x) => x.stage === key);
    return e ? new Date(e.at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dhaka" }) : "";
  };
  return (
    <div className="card steps">
      {tracked.map((s, i) => {
        const state = current < 0 ? "todo" : i < current ? "done" : i === current ? (s.key === "delivered" ? "done" : "now") : "todo";
        return (
          <div key={s.key} className={`step ${state}`}>
            <div className="rail" aria-hidden="true"><div className="dot" /><div className="bar" /></div>
            <div className="col" style={{ gap: 2, paddingBottom: 12 }}>
              <span className="name">{stageLabel(s.key)}</span>
              <span className="small mut">{state === "todo" ? "" : state === "now" ? `In progress · since ${dateOf(s.key)}` : dateOf(s.key)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export interface CardProduct { id: number; kind: string; name: string; country: string; website: string; url: string; imageUrl: string; price: number }

export function ProductCard({ p, days }: { p: CardProduct; days?: string }) {
  const stock = p.kind === "instock";
  const href = stock ? p.url || "https://ono.com.bd" : `/p/${p.id}`;
  const body = (
    <>
      {p.imageUrl ? <img src={p.imageUrl} alt="" style={{ width: "100%", height: 170, objectFit: "contain", borderRadius: 12, background: "var(--soft)" }} /> : <div aria-hidden="true" style={{ height: 170, borderRadius: 12, background: "var(--soft)" }} />}
      <span className={`tag ${stock ? "lime" : ""}`} style={{ alignSelf: "flex-start" }}>{stock ? "In stock in Dhaka" : `${p.website || "Pre-order"} · ${p.country}`}</span>
      <span className="b" style={{ lineHeight: 1.35, minHeight: 61 }}>{p.name}</span>
      <span style={{ fontSize: 17, fontWeight: 700 }}>{p.price ? taka(p.price) : "Ask for price"}{!stock && p.price ? <span className="small mut" style={{ fontWeight: 500 }}> + shipping &amp; fees</span> : null}</span>
      {!stock && days ? <span className="small mut">Arrives in about {days}</span> : null}
      <span className={stock ? "btn-outline" : "btn"}>{stock ? "Buy on Ono ↗" : "View and request quote"}</span>
    </>
  );
  return stock
    ? <a href={href} target="_blank" rel="noopener noreferrer" className="card col g8" style={{ padding: 16, textDecoration: "none" }}>{body}</a>
    : <Link href={href} className="card col g8" style={{ padding: 16, textDecoration: "none" }}>{body}</Link>;
}
