import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Eta, Shell, TotalsBox } from "@/components/site";
import { PAY_METHODS, RECEIVING } from "@/lib/config";
import { taka } from "@/lib/money";
import { getQuote, quoteIsOpen, quoteTotals } from "@/lib/store";
import { deliveryCharge, getSettings } from "@/lib/settings";
import { CheckoutForm } from "./form";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const found = await getQuote({ code });
  if (!found || found.quote.status === "draft") notFound();
  const { quote, lines } = found;
  if (!quoteIsOpen(quote)) redirect(`/q/${code}`);
  const t = quoteTotals(quote, lines);
  const settings = await getSettings();
  const charge = (k: string) => deliveryCharge(settings, k);
  return (
    <Shell>
      <div className="split">
        <div className="main col g24">
          <h1 className="d" style={{ fontSize: 34 }}>Checkout</h1>
          <CheckoutForm
            code={code}
            total={t.total}
            defaults={{ name: quote.customerName, contact: quote.customerContact }}
            receivingOpts={RECEIVING.map((r) => ({ key: r.key, label: r.label, desc: r.desc, right: charge(r.key) ? taka(charge(r.key)) : r.key === "pickup" ? "Free" : "", needsAddress: r.needsAddress }))}
            charges={Object.fromEntries(RECEIVING.map((r) => [r.key, charge(r.key)]))}
            payOpts={PAY_METHODS.map((p) => ({ key: p.key, label: p.label, desc: p.desc }))}
          />
        </div>
        <aside className="side col g16">
          <TotalsBox t={t} taxPct={Number(quote.taxPct)} servicePct={Number(quote.servicePct)} charges={lines.filter((l) => l.kind === "charge")} country={quote.country} />
          <Eta eta={quote.eta} note="You can track every stage after ordering." />
          <Link href={`/q/${code}`} className="small b">View full quote {quote.number}</Link>
        </aside>
      </div>
    </Shell>
  );
}
