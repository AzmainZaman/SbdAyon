import Link from "next/link";
import { desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { newQuote } from "../../actions";

const LABEL: Record<string, string> = { request: "New request", draft: "Draft", sent: "Sent", changes_requested: "Changes requested", accepted: "Accepted", expired: "Expired", cancelled: "Cancelled" };

export default async function QuotesList() {
  const d = await db();
  const rows = await d.select().from(schema.quotes).orderBy(desc(schema.quotes.id)).limit(200);
  return (
    <>
      <div className="sb" style={{ alignItems: "center", flexWrap: "wrap" }}><h1 className="d" style={{ fontSize: 26 }}>Quotes</h1><form action={newQuote}><button className="btn-lime">New manual quote</button></form></div>
      <div className="tablebox"><table className="t" style={{ minWidth: 640 }}>
        <thead><tr><th>Quote</th><th>Customer</th><th>Came from</th><th>Status</th><th>Opened by customer</th><th>Valid until</th></tr></thead>
        <tbody>
          {rows.length === 0 ? <tr><td colSpan={6} className="mut">No quotes yet. Create the first one.</td></tr> : rows.map((q) => (
            <tr key={q.id}>
              <td><Link className="b" href={`/admin/quotes/${q.id}`}>{q.number}</Link></td>
              <td>{q.customerName || "—"}</td><td>{q.source}</td>
              <td><span className={`tag ${q.status === "changes_requested" || q.status === "accepted" || q.status === "request" ? "lime" : ""}`}>{LABEL[q.status] ?? q.status}</span></td>
              <td>{q.viewedAt ? new Date(q.viewedAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" }) : "Not yet"}</td>
              <td>{q.validUntil}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </>
  );
}
