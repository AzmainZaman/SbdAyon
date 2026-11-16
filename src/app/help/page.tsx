import type { Metadata } from "next";
import Link from "next/link";
import { Shell } from "@/components/site";
import { COUNTRIES, SITE } from "@/lib/config";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "How it works, FAQ and contact" };
export const dynamic = "force-dynamic";

export default async function Help() {
  const s = await getSettings();
  const from = COUNTRIES.filter((c) => s.countries[c].active).join(", ");
  const faq: [string, React.ReactNode][] = [
    ["Which countries can I order from?", `${from}. Paste a link from any store in those countries.`],
    ["How is the price calculated?", `Product price in taka, the sales tax of the store's country, a ${s.servicePct}% service charge, and shipping with import duty. Every line is shown on your quote before you pay.`],
    ["How can I pay?", "bKash, card or mobile banking through SSLCommerz, or instant bank transfer to our City Bank or Eastern Bank account."],
    ["How do I track my order?", <>Open <Link href="/track">Track order</Link> with your order number and phone, or use the order link we sent you. Each stage shows its date.</>],
    ["How do I receive my order?", "Pick it up from our Malibagh office, or choose delivery inside or outside Dhaka at checkout."],
    ["Can I cancel or get a refund?", <>See our <Link href="/terms#refund">refund policy</Link>.</>],
  ];
  return (
    <Shell>
      <h1 className="d" style={{ fontSize: "clamp(30px, 4vw, 46px)" }}>How SBD works</h1>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))" }}>
        {[["01", "Pick or paste", "Choose a product on the site, or paste a link from any overseas store."], ["02", "Get your quote", "We send one price in taka with every charge listed and a delivery date."], ["03", "Accept and pay", "bKash, SSLCommerz or instant bank transfer. We buy the product once payment is confirmed."], ["04", "Track and receive", "Follow each stage, then pick up in Malibagh or get it delivered."]].map(([n, t, x]) => (
          <div key={n} className="soft col g8"><span className="d" style={{ fontSize: 28 }}>{n}</span><span className="b">{t}</span><span className="small mut">{x}</span></div>
        ))}
      </div>
      <section className="col">
        <h2 className="d" style={{ fontSize: 26, marginBottom: 12 }}>Questions</h2>
        {faq.map(([q, a]) => <details key={q} style={{ padding: "18px 0", borderTop: "1px solid var(--line)" }}><summary className="b" style={{ cursor: "pointer", fontSize: 16, minHeight: 28 }}>{q}</summary><p className="mut" style={{ marginTop: 12, maxWidth: 680 }}>{a}</p></details>)}
      </section>
      <section className="col g12" style={{ maxWidth: 560 }}>
        <h2 className="d" style={{ fontSize: 26 }}>Contact us</h2>
        <div className="card col g8">
          <div className="sb"><span className="mut">WhatsApp / phone</span><a className="b" href={`https://wa.me/${SITE.whatsapp}`}>{SITE.phone}</a></div>
          <div className="sb"><span className="mut">Order help</span><a className="b" href={`mailto:${SITE.emailSupport}`}>{SITE.emailSupport}</a></div>
          <div className="sb"><span className="mut">General</span><a className="b" href={`mailto:${SITE.emailInfo}`}>{SITE.emailInfo}</a></div>
          <div className="sb"><span className="mut">Payments</span><a className="b" href={`mailto:${SITE.emailPayments}`}>{SITE.emailPayments}</a></div>
          <div className="sb"><span className="mut">Office &amp; pickup</span><span className="b r">{SITE.address}</span></div>
          {s.hours ? <div className="sb"><span className="mut">Hours</span><span className="b">{s.hours}</span></div> : null}
        </div>
      </section>
    </Shell>
  );
}
