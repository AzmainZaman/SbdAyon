import { desc, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { taka } from "@/lib/money";
import { ImportForm } from "./import";

export default async function Customers() {
  const d = await db();
  const customers = await d.select().from(schema.customers).orderBy(desc(schema.customers.id)).limit(300);
  const buyers = await d.select({ name: sql<string>`max(${schema.orders.name})`, phone: schema.orders.phone, n: sql<number>`count(*)::int`, spent: sql<number>`coalesce(sum(${schema.orders.paid}),0)::int` })
    .from(schema.orders).groupBy(schema.orders.phone).orderBy(sql`sum(${schema.orders.paid}) desc`).limit(300);
  return (
    <>
      <h1 className="d" style={{ fontSize: 26 }}>Customers</h1>
      <ImportForm />
      <section className="col g8">
        <h2 className="b" style={{ fontSize: 17 }}>Customers with orders</h2>
        <div className="tablebox"><table className="t" style={{ minWidth: 520 }}>
          <thead><tr><th>Customer</th><th>Phone</th><th>Orders</th><th>Total paid</th></tr></thead>
          <tbody>{buyers.length === 0 ? <tr><td colSpan={4} className="mut">No orders yet.</td></tr> : buyers.map((b) => <tr key={b.phone}><td className="b">{b.name}</td><td>{b.phone}</td><td>{b.n}</td><td>{taka(b.spent)}</td></tr>)}</tbody>
        </table></div>
      </section>
      <section className="col g8">
        <h2 className="b" style={{ fontSize: 17 }}>Imported contact list</h2>
        <div className="tablebox"><table className="t" style={{ minWidth: 520 }}>
          <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Source</th></tr></thead>
          <tbody>{customers.length === 0 ? <tr><td colSpan={4} className="mut">Nothing imported yet.</td></tr> : customers.map((c) => <tr key={c.id}><td className="b">{c.name}</td><td>{c.phone}</td><td>{c.email}</td><td>{c.source}</td></tr>)}</tbody>
        </table></div>
      </section>
    </>
  );
}
