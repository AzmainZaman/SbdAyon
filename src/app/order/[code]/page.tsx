import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Eta, LinesTable, Shell, Tracker } from "@/components/site";
import { BANK_ACCOUNTS, PAY_METHODS, SITE, receiving, stageLabel } from "@/lib/config";
import { taka } from "@/lib/money";
import { getOrder } from "@/lib/store";
import { payAgain, submitBankProof } from "@/app/actions";

export const metadata: Metadata = { title: "Your order", robots: { index: false } };

const PAY_NOTE: Record<string, { text: string; bad?: boolean }> = {
  ok: { text: "Payment received. Thank you — your order is confirmed." },
  failed: { text: "The payment did not go through. Nothing was charged. You can try again below.", bad: true },
  cancelled: { text: "The payment was cancelled. You can try again below.", bad: true },
  review: { text: "Your payment is being reviewed. We will confirm it shortly." },
  error: { text: "We could not reach the payment service. Please try again in a moment, or choose another method.", bad: true },
  unavailable: { text: "This payment method is not switched on yet. Please choose another method.", bad: true },
};

export default async function OrderPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ pay?: string; proof?: string }> }) {
  const { code } = await params;
  const { pay, proof } = await searchParams;
  const found = await getOrder({ code });
  if (!found) notFound();
  const { order, items, events, payments } = found;
  const due = order.total - order.paid;
  const bank = payments.find((p) => p.method === "bank" && (p.status === "pending" || p.status === "review"));
  const paidOnes = payments.filter((p) => p.status === "paid");
  const recv = receiving(order.receiving);
  const note = pay ? PAY_NOTE[pay] : undefined;
  return (
    <Shell>
      <div className="col g8">
        <span className={`tag ${order.stage === "cancelled" ? "line" : "lime"}`} style={{ alignSelf: "flex-start" }}>{stageLabel(order.stage)}</span>
        <h1 className="d" style={{ fontSize: 32 }}>Order {order.number}</h1>
        <span className="small mut">{recv.label}{order.address ? ` · ${order.address}, ${order.district}` : ""}</span>
      </div>
      {note && !(pay === "ok" && due > 0) ? <div className={`notice ${note.bad ? "bad" : "good"}`} role="status">{note.text}</div> : null}
      {proof === "sent" ? <div className="notice good" role="status">Thanks — we will verify your transfer and confirm the order.</div> : null}

      {due > 0 && order.stage !== "cancelled" ? (
        <section className="card col g16">
          <div className="sb" style={{ alignItems: "baseline", flexWrap: "wrap" }}>
            <h2 className="d" style={{ fontSize: 22 }}>{bank ? "Complete your bank transfer" : "Payment needed"}</h2>
            <span className="d" style={{ fontSize: 26 }}>{taka(due)}</span>
          </div>
          {bank ? (
            <>
              <p>Transfer exactly <strong>{taka(due)}</strong> by NPSB, RTGS, bKash to Bank or any other instant method to one of these accounts. Put <strong>{order.number}</strong> in the payment reference.</p>
              <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))" }}>
                {BANK_ACCOUNTS.map((a) => (
                  <div key={a.number} className="soft col g8" style={{ fontSize: 14 }}>
                    <span className="b" style={{ fontSize: 16 }}>{a.bank}</span>
                    <div className="sb"><span className="mut">Account name</span><span className="b">{a.name}</span></div>
                    <div className="sb"><span className="mut">Account number</span><span className="b" style={{ fontSize: 16, userSelect: "all" }}>{a.number}</span></div>
                    <div className="sb"><span className="mut">Branch</span><span>{a.branch}</span></div>
                    <div className="sb"><span className="mut">Routing number</span><span className="b" style={{ userSelect: "all" }}>{a.routing}</span></div>
                  </div>
                ))}
              </div>
              {bank.status === "review" ? (
                <div className="notice good">We have your transfer details ({bank.note}) and are verifying the payment.</div>
              ) : (
                <form action={submitBankProof.bind(null, code)} className="col g8">
                  <label className="lbl" htmlFor="reference">After transferring, tell us the sender account name or transaction ID</label>
                  <div className="row g8"><input id="reference" name="reference" className="inp" required minLength={3} maxLength={200} style={{ flex: "1 1 240px", width: "auto" }} /><button className="btn">I have paid</button></div>
                  <span className="small mut">Then send the screenshot or bank email to WhatsApp {SITE.phone} or {SITE.emailPayments} with your order number.</span>
                </form>
              )}
            </>
          ) : null}
          <form action={payAgain.bind(null, code)} className="row g8">
            <span className="small b">{bank ? "Or pay instantly:" : "Pay with:"}</span>
            {PAY_METHODS.filter((m) => !(bank && m.key === "bank")).map((m) => <button key={m.key} name="method" value={m.key} className="sbtn">{m.key === "sslcommerz" ? "Card / mobile banking" : m.label}</button>)}
          </form>
          <span className="small mut">By paying you agree to the <a href="/terms">Terms &amp; Conditions</a> and <a href="/terms#refund">Refund policy</a>.</span>
        </section>
      ) : null}

      <div className="split" style={{ gap: 24 }}>
        <div className="side col g16">
          <Eta eta={order.eta} note={order.etaReason || undefined} />
          <Tracker stage={order.stage} events={events} />
        </div>
        <div className="main col g16">
          <LinesTable lines={items} showSerials={order.showSerials} />
          <div className="card col g8" style={{ fontSize: 14 }}>
            <span className="b" style={{ fontSize: 16 }}>Payment</span>
            <div className="sb"><span className="mut">Grand total</span><span className="b">{taka(order.total)}</span></div>
            {paidOnes.map((p) => <div key={p.id} className="sb"><span className="mut">Paid by {p.method === "sslcommerz" ? "SSLCommerz" : p.method === "bkash" ? "bKash" : p.method === "bank" ? "bank transfer" : "cash / other"}{p.trxId ? ` · ${p.trxId}` : ""}</span><span>{taka(p.amount)}</span></div>)}
            <div className="sb" style={{ paddingTop: 10, borderTop: "1px solid var(--line)" }}><span className="b">Balance due</span><span className="b">{taka(Math.max(due, 0))}</span></div>
          </div>
          {order.noteCustomer ? <div className="soft col g8" style={{ fontSize: 14 }}><span className="b">Your order note</span><span className="mut" style={{ whiteSpace: "pre-line" }}>{order.noteCustomer}</span></div> : null}
          <a className="sbtn" href={`/order/${code}/invoice`} style={{ alignSelf: "flex-start" }}>Download invoice</a>
          <span className="small mut">Questions? WhatsApp {SITE.phone} or {SITE.emailSupport}. Keep this page link — it is your tracking link.</span>
        </div>
      </div>
    </Shell>
  );
}
