import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { Eta, LinesTable, Shell, TotalsBox } from "@/components/site";
import { getQuote, quoteIsOpen, quoteTotals } from "@/lib/store";
import { requestChanges } from "@/app/actions";

export const metadata: Metadata = { title: "Your quote", robots: { index: false } };

export default async function QuotePage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ sent?: string }> }) {
  const { code } = await params;
  const { sent } = await searchParams;
  const found = await getQuote({ code });
  if (!found || found.quote.status === "draft" || found.quote.status === "cancelled") notFound();
  const { quote, lines } = found;
  if (!quote.viewedAt) {
    const d = await db();
    await d.update(schema.quotes).set({ viewedAt: new Date() }).where(eq(schema.quotes.id, quote.id));
  }
  const t = quoteTotals(quote, lines);
  const open = quoteIsOpen(quote);
  const accepted = quote.status === "accepted";
  return (
    <Shell>
      <div className="soft small">
        <strong>SBD prepared this quote{quote.customerName ? ` for ${quote.customerName}` : ""}.</strong> Review it, then accept to continue to checkout. No account or password needed.
      </div>
      <div className="col g8">
        <span className={`tag ${open ? "lime" : "line"}`} style={{ alignSelf: "flex-start" }}>
          {accepted ? "Accepted" : open ? (quote.status === "changes_requested" ? "Changes requested — SBD will update this quote" : "Waiting for your approval") : "Expired"}
        </span>
        <h1 className="d" style={{ fontSize: 32 }}>Quote {quote.number}</h1>
        {quote.validUntil ? <span className="small mut">Valid until {quote.validUntil}</span> : null}
      </div>
      {sent ? <div className="notice good">Thanks — we received your request and will update this quote.</div> : null}
      <LinesTable lines={lines} />
      <div className="split" style={{ gap: 24 }}>
        <div className="side col g16">
          <Eta eta={quote.eta} note="Counted from the day your payment is confirmed." />
          {quote.noteCustomer ? <div className="soft col g8"><span className="b">Note from SBD</span><span className="mut" style={{ whiteSpace: "pre-line" }}>{quote.noteCustomer}</span></div> : null}
          {quote.terms ? <div className="small mut" style={{ whiteSpace: "pre-line" }}>{quote.terms}</div> : null}
          {open ? (
            <details className="card">
              <summary className="b" style={{ cursor: "pointer", minHeight: 28 }}>Ask for changes</summary>
              <form action={requestChanges.bind(null, code)} className="col g12" style={{ paddingTop: 12 }}>
                <label className="sr" htmlFor="changes">What should we change?</label>
                <textarea id="changes" name="changes" className="inp" required maxLength={1000} placeholder="Remove an item, change quantity, different colour…" />
                <button className="sbtn" style={{ alignSelf: "flex-start" }}>Send request</button>
              </form>
            </details>
          ) : null}
        </div>
        <div className="side">
          <TotalsBox t={t} taxPct={Number(quote.taxPct)} servicePct={Number(quote.servicePct)} charges={lines.filter((l) => l.kind === "charge")} country={quote.country}>
            {open ? (
              <>
                <Link className="btn-lime" href={`/checkout/${code}`} style={{ minHeight: 56, fontSize: 15 }}>Accept and continue to checkout</Link>
                <span className="small mut" style={{ textAlign: "center" }}>Next: choose pickup or delivery, then pay by bKash, card or bank transfer.</span>
              </>
            ) : (
              <div className="notice">{accepted ? "This quote has been accepted. Use your order link to track it." : "This quote has expired. Please message SBD for an updated quote."}</div>
            )}
          </TotalsBox>
        </div>
      </div>
    </Shell>
  );
}
