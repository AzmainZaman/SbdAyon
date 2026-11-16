/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SITE, receiving } from "@/lib/config";
import { taka, takaInWords } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { getOrder } from "@/lib/store";
import { PrintButton } from "./print";

export const metadata: Metadata = { title: "Invoice", robots: { index: false } };

const day = (d: Date) => new Date(d).toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "long", year: "numeric" });
const METHOD: Record<string, string> = { bkash: "bKash", sslcommerz: "SSLCommerz", bank: "Bank transfer", manual: "Cash / other" };

export default async function Invoice({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const found = await getOrder({ code });
  if (!found) notFound();
  const { order: o, items, payments } = found;
  const s = await getSettings();
  const t = (o.totals ?? {}) as Record<string, number>;
  const due = Math.max(o.total - o.paid, 0);
  const paid = payments.filter((p) => p.status === "paid");
  const products = items.filter((i) => i.kind === "item");
  const row = (k: string, v: string) => <div className="sb" key={k}><span className="mut">{k}</span><span className="b r">{v}</span></div>;
  return (
    <div className="invoice-page">
      <style>{`
        .invoice-page { background: var(--soft); min-height: 100vh; padding: 24px 12px; }
        .sheet { background: #fff; width: 100%; max-width: 794px; margin: 0 auto; padding: 44px 48px 0; display: flex; flex-direction: column; gap: 22px; font-size: 12px; }
        .sheet table { width: 100%; border-collapse: collapse; } .sheet th { padding: 8px 10px; text-align: left; font-weight: 700; border-bottom: 2px solid var(--ink); }
        .sheet td { padding: 7px 10px; border-bottom: 1px solid #D5D8CC; vertical-align: middle; }
        .foot { margin: 8px -48px 0; } .foot .web { text-align: center; padding: 9px 0 7px; border-top: 1.5px solid var(--ink); border-bottom: 1.5px solid var(--ink); font-size: 20px; text-transform: none; }
        .foot .cells { display: grid; grid-template-columns: 30% 38% 32%; text-align: center; font-size: 14px; } .foot .cells > div { padding: 14px 8px 18px; }
        .foot .mid { border-left: 1.5px solid var(--ink); border-right: 1.5px solid var(--ink); }
        @media print { .no-print { display: none !important; } .invoice-page { background: #fff; padding: 0; } .sheet { max-width: none; } @page { size: A4; margin: 0; } }
      `}</style>
      <div className="no-print row g8" style={{ maxWidth: 794, margin: "0 auto 16px", justifyContent: "space-between" }}>
        <a className="sbtn" href={`/order/${o.code}`}>← Back to order</a><PrintButton />
      </div>
      <div className="sheet">
        <div className="sb" style={{ alignItems: "flex-start" }}>
          <img src="/sbd-logo.png" alt="SBD" style={{ height: 46 }} />
          <div className="col r" style={{ gap: 2 }}><span className="d" style={{ fontSize: 17 }}>{SITE.name}</span><span className="b">{SITE.tagline}</span></div>
        </div>
        <div className="sb" style={{ alignItems: "flex-end", gap: 24 }}>
          <div className="col g8">
            <div className="row g12"><h1 className="d" style={{ fontSize: 34 }}>Invoice</h1><span className={`tag ${due === 0 ? "lime" : "line"}`}>{due === 0 ? "PAID" : o.paid > 0 ? "PARTLY PAID" : "UNPAID"}</span></div>
            <div className="col" style={{ gap: 2 }}><span className="mut">Billed to</span><span className="b" style={{ fontSize: 14 }}>{o.name}</span><span>{[o.phone, o.email].filter(Boolean).join(" · ")}</span><span>{o.address ? `${o.address}, ${o.district}` : receiving(o.receiving).label}</span></div>
          </div>
          <div className="col" style={{ width: 250, gap: 4 }}>{row("Invoice no.", `INV-${o.number.replace(/^[A-Z]+-/, "")}`)}{row("Invoice date", day(o.createdAt))}{row("Order no.", o.number)}{o.eta ? row("Estimated delivery", o.eta) : null}</div>
        </div>
        <table>
          <thead><tr><th style={{ width: 28 }}>Sl</th><th style={{ width: 44 }}>Image</th><th>Product</th><th style={{ width: 80 }}>Website</th><th style={{ width: 30, textAlign: "center" }}>Qty</th><th style={{ width: 80, textAlign: "right" }}>Price</th></tr></thead>
          <tbody>
            {items.map((i) => {
              if (i.kind === "charge") return null;
              if (i.kind !== "item") return <tr key={i.id}><td colSpan={6} style={{ background: i.kind === "heading" ? "var(--lime)" : "var(--soft)", fontWeight: i.kind === "heading" ? 700 : 400 }}>{i.name}</td></tr>;
              return (
                <tr key={i.id}>
                  <td>{products.indexOf(i) + 1}</td>
                  <td>{i.imageUrl ? <img src={i.imageUrl} alt="" style={{ width: 34, height: 34, objectFit: "contain" }} /> : null}</td>
                  <td><span className="b">{i.name}</span>{o.showSerials && i.serials ? <span className="mut" style={{ display: "block" }}>Serial no. {i.serials}</span> : null}</td>
                  <td>{i.website}</td><td style={{ textAlign: "center" }}>{i.qty}</td><td className="r b">{taka(i.price * i.qty)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="sb" style={{ alignItems: "flex-start", gap: 32 }}>
          <div className="col g12" style={{ flex: "1 1 auto", lineHeight: 1.5 }}>
            <div className="col" style={{ gap: 2 }}><span className="b">Payment</span>{paid.length ? paid.map((p) => <span key={p.id}>{taka(p.amount)} by {METHOD[p.method] ?? p.method}{p.paidAt ? ` on ${day(p.paidAt)}` : ""}{p.trxId ? ` · ${p.trxId}` : ""}</span>) : <span>No payment received yet.</span>}{due > 0 ? <span className="b">Balance due: {taka(due)}</span> : null}</div>
            <div className="col" style={{ gap: 2 }}><span className="b">Receiving</span><span>{receiving(o.receiving).label}</span></div>
            {s.quoteTerms ? <div className="col" style={{ gap: 2 }}><span className="b">Terms</span><span style={{ whiteSpace: "pre-line" }}>{s.quoteTerms}</span></div> : null}
          </div>
          <div className="col" style={{ flex: "0 0 270px", gap: 6 }}>
            {t.items != null ? <>{row(`Items (${t.itemCount ?? products.length})`, taka(t.items))}{t.tax ? row("Sales Tax", taka(t.tax)) : null}{row("Subtotal", taka(t.subtotal))}{t.service ? row("Service Charge", taka(t.service)) : null}{t.shipping ? row("Shipping & Import Duty", taka(t.shipping)) : null}</> : null}
            {items.filter((i) => i.kind === "charge").map((c) => row(c.name || "Other charge", taka(c.price)))}
            {t.discount ? row("Discount", taka(-t.discount)) : null}{o.deliveryCharge ? row("Delivery", taka(o.deliveryCharge)) : null}
            <div className="sb" style={{ alignItems: "baseline", padding: "10px 12px", marginTop: 4, background: "var(--lime)", borderRadius: 8 }}><span className="b" style={{ fontSize: 13 }}>Grand Total</span><span className="d" style={{ fontSize: 22 }}>{taka(o.total)}</span></div>
            <span className="r b">In words: {takaInWords(o.total)}</span>
          </div>
        </div>
        <div className="foot">
          <div className="web d">sbd.com.bd</div>
          <div className="cells"><div>Facebook · Instagram<br />{SITE.social}</div><div className="mid">{SITE.emailInfo}<br />{SITE.phone}</div><div>254 New Circular Road,<br />Malibagh, Dhaka 1217</div></div>
        </div>
      </div>
    </div>
  );
}
