import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { taka } from "@/lib/money";
import { newQuote } from "../actions";

function Tile({ label, n, href, go }: { label: string; n: number; href: string; go: string }) {
  return <Link href={href} className="card col g12" style={{ textDecoration: "none" }}><span className="small b mut">{label}</span><span className="d" style={{ fontSize: 30 }}>{n}</span><span className="small b">{go} →</span></Link>;
}

export default async function AdminHome() {
  const d = await db();
  const { orders, payments, quotes } = schema;
  const [[toVerify], [toBuy], [changes]] = await Promise.all([
    d.select({ n: sql<number>`count(*)::int` }).from(payments).where(eq(payments.status, "review")),
    d.select({ n: sql<number>`count(*)::int` }).from(orders).where(eq(orders.stage, "confirmed")),
    d.select({ n: sql<number>`count(*)::int` }).from(quotes).where(eq(quotes.status, "changes_requested")),
  ]);
  const review = await d.select({ p: payments, o: orders }).from(payments).innerJoin(orders, eq(orders.id, payments.orderId)).where(eq(payments.status, "review")).orderBy(desc(payments.id)).limit(20);
  return (
    <>
      <div className="sb" style={{ alignItems: "center", flexWrap: "wrap" }}><h1 className="d" style={{ fontSize: 26 }}>Today</h1><form action={newQuote}><button className="btn-lime">New manual quote</button></form></div>
      <div className="grid">
        <Tile label="Payments to verify" n={toVerify.n} href="/admin/orders" go="Verify payments" />
        <Tile label="Paid, waiting to be purchased" n={toBuy.n} href="/admin/orders" go="Purchase list" />
        <Tile label="Quotes with change requests" n={changes.n} href="/admin/quotes" go="Open quotes" />
      </div>
      <section className="col g8">
        <h2 className="b" style={{ fontSize: 17 }}>Payments to verify</h2>
        <div className="tablebox"><table className="t" style={{ minWidth: 560 }}>
          <thead><tr><th>Order</th><th>Customer</th><th>Amount</th><th>Method</th><th>Customer&apos;s reference</th></tr></thead>
          <tbody>
            {review.length === 0 ? <tr><td colSpan={5} className="mut">Nothing waiting.</td></tr> : review.map(({ p, o }) => (
              <tr key={p.id}><td><Link className="b" href={`/admin/orders/${o.id}`}>{o.number}</Link></td><td>{o.name}</td><td>{taka(p.amount)}</td><td>{p.method}</td><td>{p.note}</td></tr>
            ))}
          </tbody>
        </table></div>
      </section>
    </>
  );
}
