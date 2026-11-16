/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { Eta, Shell } from "@/components/site";
import { taka } from "@/lib/money";
import { getSettings } from "@/lib/settings";

async function load(id: string) {
  const d = await db();
  const [p] = await d.select().from(schema.products).where(and(eq(schema.products.id, Number(id) || 0), eq(schema.products.visible, true)));
  return p;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const p = await load((await params).id);
  return { title: p?.name ?? "Product" };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const p = await load((await params).id);
  if (!p || p.kind !== "preorder") notFound();
  const s = await getSettings();
  const c = s.countries[p.country];
  const tax = Math.round((p.price * (c?.taxPct ?? 0)) / 100);
  const service = Math.round(((p.price + tax) * s.servicePct) / 100);
  return (
    <Shell>
      <nav className="small mut"><Link href="/">Home</Link> / <Link href={`/#from-${p.country}`}>{p.country}</Link></nav>
      <div className="split">
        <div className="side">{p.imageUrl ? <img src={p.imageUrl} alt={p.name} style={{ width: "100%", maxHeight: 460, objectFit: "contain", borderRadius: 24, background: "var(--soft)" }} /> : <div aria-hidden="true" style={{ height: 380, borderRadius: 24, background: "var(--soft)" }} />}</div>
        <div className="side col g16">
          <div className="row g8"><span className="tag">Pre-order</span><span className="tag">{p.website} · {p.country}</span></div>
          <h1 style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.25 }}>{p.name}</h1>
          {p.price ? <div className="row g12" style={{ alignItems: "baseline" }}><span className="d" style={{ fontSize: 34 }}>{taka(p.price)}</span><span className="small mut">product price</span></div> : null}
          <Eta eta={c?.days ? `About ${c.days}` : ""} note={c?.nextShipment ? `Next shipment from ${p.country} leaves ${c.nextShipment}` : undefined} />
          {p.price ? (
            <div className="soft col g8" style={{ fontSize: 14 }}>
              <div className="sb"><span className="mut">Product price</span><span>{taka(p.price)}</span></div>
              {tax ? <div className="sb"><span className="mut">{p.country} sales tax ({c.taxPct}%)</span><span>{taka(tax)}</span></div> : null}
              <div className="sb"><span className="mut">Service charge ({s.servicePct}%)</span><span>{taka(service)}</span></div>
              <div className="sb"><span className="mut">Shipping &amp; import duty</span><span>by weight, in your quote</span></div>
              <span className="small mut">You pay only after SBD confirms the final quote.</span>
            </div>
          ) : null}
          <Link className="btn-lime" href={`/request?product=${p.id}`} style={{ minHeight: 54 }}>Request a quote for this</Link>
          {p.url ? <a className="small b" href={p.url} target="_blank" rel="noopener noreferrer">View the original listing on {p.website || "the store"} ↗</a> : null}
        </div>
      </div>
      {p.description ? <section className="col g8"><h2 className="d" style={{ fontSize: 22 }}>Product details</h2><p className="mut" style={{ maxWidth: 720, whiteSpace: "pre-line" }}>{p.description}</p></section> : null}
    </Shell>
  );
}
