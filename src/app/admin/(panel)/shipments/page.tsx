import Link from "next/link";
import { desc, notInArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { COUNTRIES, STAGES, stageLabel } from "@/lib/config";
import { assignShipment, moveShipment, saveShipment } from "../../more-actions";

export default async function Shipments({ searchParams }: { searchParams: Promise<{ moved?: string }> }) {
  const { moved } = await searchParams;
  const d = await db();
  const ships = await d.select().from(schema.shipments).orderBy(desc(schema.shipments.id)).limit(100);
  const orders = await d.select().from(schema.orders).where(notInArray(schema.orders.stage, ["delivered", "cancelled", "awaiting_payment"])).orderBy(desc(schema.orders.id)).limit(500);
  const tracked = STAGES.filter((s) => s.tracked);
  return (
    <>
      <h1 className="d" style={{ fontSize: 26 }}>Shipments</h1>
      <p className="small mut" style={{ maxWidth: 640 }}>A shipment groups orders travelling together. Moving it updates every order in it and, if ticked, tells those customers.</p>
      {moved ? <div className="notice good" role="status">{moved} orders updated.</div> : null}
      <form action={saveShipment} className="card row g8" style={{ alignItems: "flex-end" }}>
        <div style={{ flex: "2 1 180px" }}><label className="lbl" htmlFor="name">New shipment name</label><input id="name" name="name" className="inp sm" required placeholder="e.g. USA December 1" /></div>
        <div style={{ flex: "1 1 120px" }}><label className="lbl" htmlFor="country">From</label><select id="country" name="country" className="inp sm">{COUNTRIES.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div style={{ flex: "1 1 130px" }}><label className="lbl" htmlFor="leaves">Leaves</label><input id="leaves" name="leaves" className="inp sm" placeholder="5 December" /></div>
        <div style={{ flex: "1 1 150px" }}><label className="lbl" htmlFor="eta">Delivery estimate</label><input id="eta" name="eta" className="inp sm" placeholder="20–25 December" /></div>
        <button className="btn" style={{ minHeight: 44 }}>Create</button>
      </form>
      {ships.map((sh) => {
        const mine = orders.filter((o) => o.shipmentId === sh.id);
        return (
          <section key={sh.id} className="card col g12">
            <div className="sb" style={{ flexWrap: "wrap", alignItems: "center" }}>
              <span className="b" style={{ fontSize: 16 }}>{sh.name} · {sh.country}</span>
              <span className="row g8"><span className="tag lime">{stageLabel(sh.stage)}</span><span className="small mut">Leaves {sh.leaves || "—"} · delivery {sh.eta || "—"} · {mine.length} open orders</span></span>
            </div>
            <form action={moveShipment.bind(null, sh.id)} className="row g8" style={{ alignItems: "flex-end" }}>
              <div style={{ flex: "1 1 200px" }}><label className="lbl" htmlFor={`st${sh.id}`}>Move all orders to</label><select id={`st${sh.id}`} name="stage" className="inp sm" defaultValue={sh.stage}>{tracked.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></div>
              <div style={{ flex: "1 1 150px" }}><label className="lbl" htmlFor={`eta${sh.id}`}>New delivery estimate (optional)</label><input id={`eta${sh.id}`} name="eta" className="inp sm" /></div>
              <div style={{ flex: "2 1 200px" }}><label className="lbl" htmlFor={`why${sh.id}`}>Reason shown to customers</label><input id={`why${sh.id}`} name="reason" className="inp sm" /></div>
              <label className="check small" style={{ minHeight: 44, alignItems: "center" }}><input type="checkbox" name="notify" defaultChecked />Tell customers</label>
              <button className="btn" style={{ minHeight: 44 }}>Update shipment</button>
            </form>
            {mine.length ? <div className="row g8">{mine.map((o) => <Link key={o.id} className="tag" href={`/admin/orders/${o.id}`}>{o.number} · {o.name}</Link>)}</div> : <span className="small mut">No orders in this shipment yet.</span>}
          </section>
        );
      })}
      <form action={assignShipment} className="card col g12">
        <span className="b">Put orders into a shipment</span>
        <div className="tablebox"><table className="t" style={{ minWidth: 560 }}>
          <thead><tr><th></th><th>Order</th><th>Customer</th><th>Stage</th><th>Current shipment</th></tr></thead>
          <tbody>
            {orders.length === 0 ? <tr><td colSpan={5} className="mut">No paid, undelivered orders.</td></tr> : orders.map((o) => (
              <tr key={o.id}>
                <td><input type="checkbox" name="orderId" value={o.id} aria-label={`Select ${o.number}`} style={{ width: 20, height: 20, accentColor: "var(--ink)" }} /></td>
                <td className="b">{o.number}</td><td>{o.name}</td><td>{stageLabel(o.stage)}</td>
                <td>{ships.find((s) => s.id === o.shipmentId)?.name ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
        <div className="row g8"><label className="sr" htmlFor="shipmentId">Shipment</label><select id="shipmentId" name="shipmentId" className="inp sm" style={{ width: "auto", minWidth: 220 }}><option value="">No shipment</option>{ships.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select><button className="btn" style={{ minHeight: 44 }}>Move selected orders</button></div>
      </form>
    </>
  );
}
