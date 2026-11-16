import Link from "next/link";
import { desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { receiving, stageLabel } from "@/lib/config";
import { taka } from "@/lib/money";

export default async function OrdersList() {
  const d = await db();
  const rows = await d.select().from(schema.orders).orderBy(desc(schema.orders.id)).limit(300);
  return (
    <>
      <h1 className="d" style={{ fontSize: 26 }}>Orders</h1>
      <div className="tablebox"><table className="t" style={{ minWidth: 820 }}>
        <thead><tr><th>Order</th><th>Customer</th><th>Stage</th><th>Est. delivery</th><th>Total</th><th>Payment</th><th>Receiving</th><th>Placed</th></tr></thead>
        <tbody>
          {rows.length === 0 ? <tr><td colSpan={8} className="mut">No orders yet. Orders appear here when a customer accepts a quote and checks out.</td></tr> : rows.map((o) => {
            const due = o.total - o.paid;
            return (
              <tr key={o.id}>
                <td><Link className="b" href={`/admin/orders/${o.id}`}>{o.number}</Link></td>
                <td>{o.name}<span className="small mut" style={{ display: "block" }}>{o.phone}</span></td>
                <td><span className={`tag ${["awaiting_payment", "delivered", "cancelled"].includes(o.stage) ? "line" : "lime"}`}>{stageLabel(o.stage)}</span></td>
                <td>{o.eta || "—"}</td>
                <td className="nowrap">{taka(o.total)}</td>
                <td>{due <= 0 ? <span className="tag">Paid</span> : <span className="tag line">Due {taka(due)}</span>}</td>
                <td>{receiving(o.receiving).key === "pickup" ? "Pickup" : receiving(o.receiving).key === "inside_dhaka" ? "Inside Dhaka" : "Outside Dhaka"}</td>
                <td className="nowrap">{new Date(o.createdAt).toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "short" })}</td>
              </tr>
            );
          })}
        </tbody>
      </table></div>
    </>
  );
}
