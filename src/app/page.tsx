import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { Footer, Header, ProductCard } from "@/components/site";
import { COUNTRIES } from "@/lib/config";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function Home() {
  const d = await db();
  const [settings, products] = await Promise.all([getSettings(), d.select().from(schema.products).where(eq(schema.products.visible, true)).orderBy(desc(schema.products.id)).limit(200)]);
  const active = COUNTRIES.filter((c) => settings.countries[c].active);
  const stock = products.filter((p) => p.kind === "instock");
  return (
    <>
      <Header />
      <main className="wrap col" style={{ paddingTop: 24, gap: 40 }}>
        <section className="row g16" style={{ alignItems: "stretch" }}>
          <div className="limebox col g16" style={{ flex: "999 1 520px", minHeight: 380, padding: 40, borderRadius: 24, justifyContent: "flex-end" }}>
            <h1 className="d" style={{ fontSize: "clamp(32px, 4.6vw, 58px)", letterSpacing: "-0.02em" }}>Shop the world.<br />Delivered in Bangladesh.</h1>
            <p style={{ fontSize: 17, maxWidth: 480 }}>Pre-order from stores abroad. One price in taka, a delivery date before you pay, and tracking until it reaches you.</p>
            <div className="row g12">
              <a className="btn" href="#countries" style={{ minHeight: 54 }}>Shop by country</a>
              <Link className="btn-outline" href="/request" style={{ minHeight: 54, background: "transparent" }}>Paste a link for a quote</Link>
            </div>
          </div>
          <div className="col g16" style={{ flex: "1 1 300px" }}>
            <Link href="/track" className="soft col" style={{ flex: "1 1 auto", justifyContent: "space-between", gap: 16, textDecoration: "none", padding: 24 }}>
              <span className="d" style={{ fontSize: 20 }}>Track your order</span><span className="b small">Order number and phone →</span>
            </Link>
            <Link href="/rates" className="col" style={{ flex: "1 1 auto", justifyContent: "space-between", gap: 16, textDecoration: "none", padding: 22, borderRadius: 18, border: "2px solid var(--ink)" }}>
              <span className="d" style={{ fontSize: 20 }}>Cost calculator</span><span className="b small">Estimate price and delivery date →</span>
            </Link>
          </div>
        </section>

        <section id="countries" className="col g16">
          <div className="sb" style={{ alignItems: "baseline", flexWrap: "wrap" }}><h2 className="d" style={{ fontSize: 26 }}>Shop by country</h2><Link href="/rates" className="small b">All delivery times &amp; rates</Link></div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(170px, 100%), 1fr))" }}>
            {active.map((c) => {
              const r = settings.countries[c];
              return (
                <a key={c} href={`#from-${c}`} className="col" style={{ textDecoration: "none", padding: 20, borderRadius: 18, border: "2px solid var(--line)", gap: 28 }}>
                  <span className="d" style={{ fontSize: 20 }}>{c}</span>
                  <span className="col small" style={{ gap: 4 }}><span>Delivery <strong>{r.days || "on request"}</strong></span><span>Next shipment <strong>{r.nextShipment || "ask us"}</strong></span></span>
                </a>
              );
            })}
          </div>
        </section>

        {active.map((c) => {
          const list = products.filter((p) => p.kind === "preorder" && p.country === c).slice(0, 8);
          if (!list.length) return null;
          return (
            <section key={c} id={`from-${c}`} className="col g16">
              <h2 className="d" style={{ fontSize: 26 }}>From {c === "USA" || c === "UAE" ? `the ${c}` : c}</h2>
              <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))", gap: 16 }}>{list.map((p) => <ProductCard key={p.id} p={p} days={settings.countries[c].days} />)}</div>
            </section>
          );
        })}

        {stock.length ? (
          <section className="col g16">
            <div className="sb" style={{ alignItems: "baseline", flexWrap: "wrap" }}><h2 className="d" style={{ fontSize: 26 }}>Already in Dhaka</h2><span className="small mut">In stock · these open on Ono</span></div>
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))", gap: 16 }}>{stock.slice(0, 8).map((p) => <ProductCard key={p.id} p={p} />)}</div>
          </section>
        ) : null}

        <section className="col g16">
          <h2 className="d" style={{ fontSize: 26 }}>How pre-order works</h2>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))" }}>
            {[["01", "Pick or paste", "Choose a product here, or paste a link from any overseas store."], ["02", "Get your quote", "One price in taka with every charge listed, plus the delivery date."], ["03", "Pay your way", "bKash, cards through SSLCommerz, or instant bank transfer."], ["04", "Track to your door", "Pickup in Malibagh, or delivery inside and outside Dhaka."]].map(([n, t, x]) => (
              <div key={n} className="soft col g8"><span className="d" style={{ fontSize: 28 }}>{n}</span><span className="b">{t}</span><span className="small mut">{x}</span></div>
            ))}
          </div>
        </section>

        <section className="limebox row" style={{ padding: 36, borderRadius: 24, justifyContent: "space-between", gap: 20 }}>
          <div className="col" style={{ gap: 6, flex: "1 1 320px" }}><h2 className="d" style={{ fontSize: 24 }}>Want something that isn&apos;t listed?</h2><span>Paste a link from any overseas store and we&apos;ll send a quote in taka.</span></div>
          <Link className="btn" href="/request" style={{ minHeight: 54 }}>Request a quote</Link>
        </section>
      </main>
      <Footer />
    </>
  );
}
