import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/copy";
import { STAGES, receiving, stageLabel } from "@/lib/config";
import { taka } from "@/lib/money";
import { baseUrl } from "@/lib/pay";
import { getOrder } from "@/lib/store";
import { updateOrder } from "../../../actions";

const when = (d: Date) => new Date(d).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" });

export default async function OrderAdmin({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = await getOrder({ id: Number(id) });
  if (!found) notFound();
  const { order: o, items, events, payments } = found;
  const act = updateOrder.bind(null, o.id);
  const due = o.total - o.paid;
  const link = `${await baseUrl()}/order/${o.code}`;
  const recv = receiving(o.receiving);
  return (
    <>
      <div className="row g12">
        <h1 className="d" style={{ fontSize: 26 }}>Order {o.number}</h1>
        <span className="tag lime">{stageLabel(o.stage)}</span>
        <span className="small mut">{o.name} · {o.phone}{o.email ? ` · ${o.email}` : ""}</span>
        {o.quoteId ? <Link className="small b" href={`/admin/quotes/${o.quoteId}`}>View quote</Link> : null}
      </div>
      <div className="split" style={{ gap: 20 }}>
        <div className="main col g16">
          <div className="card col g12">
            <span className="b">Stage and delivery date</span>
            <form action={act} className="row g8" style={{ alignItems: "flex-end" }}>
              <div style={{ flex: "1 1 220px" }}><label className="lbl" htmlFor="stage">Move to stage</label><select id="stage" name="stage" className="inp sm" defaultValue={o.stage}>{STAGES.filter((s) => s.key !== "cancelled").map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></div>
              <div style={{ flex: "1 1 220px" }}><label className="lbl" htmlFor="stageNote">Note (optional)</label><input id="stageNote" name="stageNote" className="inp sm" /></div>
              <label className="check small" style={{ minHeight: 44, alignItems: "center" }}><input type="checkbox" name="notify" defaultChecked />Tell the customer</label>
              <button className="btn" name="intent" value="stage" style={{ minHeight: 44 }}>Update stage</button>
            </form>
            <form action={act} className="row g8" style={{ alignItems: "flex-end" }}>
              <div style={{ flex: "1 1 180px" }}><label className="lbl" htmlFor="eta">Estimated delivery</label><input id="eta" name="eta" className="inp sm" defaultValue={o.eta} placeholder="For example: 10–17 December" /></div>
              <div style={{ flex: "2 1 240px" }}><label className="lbl" htmlFor="etaReason">Reason shown to customer if the date changed</label><input id="etaReason" name="etaReason" className="inp sm" defaultValue={o.etaReason} /></div>
              <label className="check small" style={{ minHeight: 44, alignItems: "center" }}><input type="checkbox" name="notify" defaultChecked />Tell the customer</label>
              <button className="sbtn" name="intent" value="eta">Save date</button>
            </form>
          </div>

          <form action={act} className="col g8">
            <span className="b">Items, purchase details and serial numbers</span>
            <div className="tablebox"><table className="t" style={{ minWidth: 760 }}>
              <thead><tr><th>Item</th><th>Qty</th><th>Store order no.</th><th>Overseas tracking</th><th>Cost ৳</th><th>Serial / IMEI</th></tr></thead>
              <tbody>
                {items.filter((i) => i.kind === "item").map((i) => (
                  <tr key={i.id}>
                    <td className="b">{i.url ? <a href={i.url} target="_blank" rel="noopener noreferrer">{i.name}</a> : i.name}<input type="hidden" name="itemId" value={i.id} /></td>
                    <td>{i.qty}</td>
                    <td><input name="storeOrderNo" aria-label="Store order number" className="inp sm" style={{ width: 130 }} defaultValue={i.storeOrderNo} /></td>
                    <td><input name="tracking" aria-label="Overseas tracking number" className="inp sm" style={{ width: 130 }} defaultValue={i.tracking} /></td>
                    <td><input name="cost" aria-label="Actual cost" className="inp sm" style={{ width: 90 }} defaultValue={i.cost || ""} /></td>
                    <td><input name="serials" aria-label="Serial numbers" className="inp sm" style={{ width: 170 }} defaultValue={i.serials} placeholder="Separate with commas" /></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
            <button className="sbtn" name="intent" value="items" style={{ alignSelf: "flex-start" }}>Save item details</button>
          </form>

          <form action={act} className="card col g12">
            <span className="b">Notes</span>
            {o.noteCustomer ? <div className="soft small"><strong>Customer&apos;s order note:</strong> {o.noteCustomer}</div> : null}
            <div><label className="lbl" htmlFor="noteInternal">Internal note</label><textarea id="noteInternal" name="noteInternal" className="inp" defaultValue={o.noteInternal} /></div>
            <label className="check small"><input type="checkbox" name="showSerials" defaultChecked={o.showSerials} />Show serial numbers on the customer&apos;s order page</label>
            <button className="sbtn" name="intent" value="notes" style={{ alignSelf: "flex-start" }}>Save notes</button>
          </form>

          <div className="card col g8">
            <span className="b">History</span>
            {events.map((e) => <span key={e.id} className="small mut">{when(e.at)} · {e.stage ? stageLabel(e.stage) : ""}{e.note ? ` — ${e.note}` : ""}</span>)}
          </div>
        </div>

        <aside className="side col g16">
          <div className="card col g12" style={{ fontSize: 14 }}>
            <span className="b">Payment</span>
            <div className="sb"><span className="mut">Grand total</span><span className="b">{taka(o.total)}</span></div>
            <div className="sb"><span className="mut">Received</span><span>{taka(o.paid)}</span></div>
            <div className="sb"><span className="mut">Balance due</span><span className="b">{taka(Math.max(due, 0))}</span></div>
            {payments.map((p) => (
              <form key={p.id} action={act} className="soft col g8" style={{ padding: 14 }}>
                <div className="sb"><span className="b">{p.method} · {taka(p.amount)}</span><span className={`tag ${p.status === "paid" ? "lime" : "line"}`}>{p.status === "review" ? "to verify" : p.status}</span></div>
                {p.trxId ? <span className="small">Transaction: {p.trxId}</span> : null}
                {p.note ? <span className="small mut">{p.note}</span> : null}
                {p.status === "review" || (p.status === "pending" && p.method === "bank") ? (
                  <div className="row g8"><button className="sbtn lime" name="intent" value={`verify:${p.id}`}>Verify payment</button><button className="sbtn" name="intent" value={`reject:${p.id}`}>Reject</button></div>
                ) : null}
              </form>
            ))}
            <form action={act} className="col g8">
              <span className="lbl" style={{ margin: 0 }}>Record a payment you received yourself</span>
              <div className="row g8"><input name="amount" aria-label="Amount" className="inp sm" style={{ flex: "1 1 90px", width: "auto" }} placeholder="৳ amount" /><input name="payRef" aria-label="Reference" className="inp sm" style={{ flex: "2 1 140px", width: "auto" }} placeholder="Cash / reference" /></div>
              <button className="sbtn" name="intent" value="manualPayment" style={{ alignSelf: "flex-start" }}>Record payment</button>
            </form>
          </div>
          <div className="card col g8" style={{ fontSize: 14 }}>
            <span className="b">Receiving</span>
            <span>{recv.label}{o.deliveryCharge ? ` · ${taka(o.deliveryCharge)}` : ""}</span>
            {o.address ? <span className="mut">{o.address}, {o.district}</span> : null}
          </div>
          <div className="card col g12" style={{ fontSize: 14 }}>
            <span className="b">Customer&apos;s tracking link</span>
            <div className="row g8" style={{ flexWrap: "nowrap" }}><input readOnly aria-label="Tracking link" className="inp sm" value={link} /><CopyButton text={link} /></div>
            {due > 0 ? <span className="small mut">The customer can also pay from this link.</span> : null}
          </div>
          <a className="sbtn" href={`/order/${o.code}/invoice`} target="_blank" rel="noopener noreferrer">Open invoice</a>
          <form action={act}><button className="sbtn" name="intent" value="cancelOrder">Cancel order</button></form>
        </aside>
      </div>
    </>
  );
}
