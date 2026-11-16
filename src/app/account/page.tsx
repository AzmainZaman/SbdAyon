import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { Shell } from "@/components/site";
import { stageLabel } from "@/lib/config";
import { taka } from "@/lib/money";
import { currentCustomer, isEmail } from "@/lib/session";
import { customerLogout } from "@/app/actions";
import { LoginForm } from "./login";

export const metadata: Metadata = { title: "My account", robots: { index: false } };

export default async function Account() {
  const me = await currentCustomer();
  if (!me) return <Shell><LoginForm /><span className="small mut">You can also follow an order without signing in: <Link href="/track">Track order</Link>.</span></Shell>;
  const d = await db();
  const { orders, quotes } = schema;
  // Phones are matched on their last 10 digits so +880, 880 and 0 prefixes all find the same orders.
  const orderMatch = isEmail(me) ? eq(sql`lower(${orders.email})`, me) : eq(sql`right(regexp_replace(${orders.phone}, '\\D', '', 'g'), 10)`, me.slice(-10));
  const quoteMatch = isEmail(me) ? eq(sql`lower(${quotes.customerContact})`, me) : eq(sql`right(regexp_replace(${quotes.customerContact}, '\\D', '', 'g'), 10)`, me.slice(-10));
  const [myOrders, myQuotes] = await Promise.all([
    d.select().from(orders).where(orderMatch).orderBy(desc(orders.id)).limit(100),
    d.select().from(quotes).where(sql`${quoteMatch} and ${or(eq(quotes.status, "sent"), eq(quotes.status, "changes_requested"))}`).orderBy(desc(quotes.id)).limit(20),
  ]);
  return (
    <Shell>
      <div className="sb" style={{ alignItems: "center", flexWrap: "wrap" }}>
        <div className="col" style={{ gap: 4 }}><h1 className="d" style={{ fontSize: 30 }}>My account</h1><span className="small mut">Signed in as {me}</span></div>
        <div className="row g8"><Link className="btn-lime" href="/request">Request a new quote</Link><form action={customerLogout}><button className="sbtn">Sign out</button></form></div>
      </div>
      {myQuotes.map((q) => (
        <section key={q.id} className="limebox row" style={{ justifyContent: "space-between", gap: 16 }}>
          <div className="col" style={{ gap: 4, flex: "1 1 300px" }}><span className="small b">Quote waiting for your approval</span><span className="b" style={{ fontSize: 18 }}>{q.number}</span><span className="small">{q.validUntil ? `Valid until ${q.validUntil}` : ""}{q.eta ? ` · estimated delivery ${q.eta}` : ""}</span></div>
          <Link className="btn" href={`/q/${q.code}`}>View and pay</Link>
        </section>
      ))}
      <section className="col g12">
        <h2 className="b" style={{ fontSize: 18 }}>My orders</h2>
        {myOrders.length === 0 ? <div className="soft">No orders yet for {me}. If you ordered with a different phone or email, sign in with that one.</div> : (
          <div className="tablebox"><table className="t" style={{ minWidth: 620 }}>
            <thead><tr><th>Order</th><th>Status</th><th>Estimated delivery</th><th>Total</th><th>Balance</th><th></th></tr></thead>
            <tbody>
              {myOrders.map((o) => (
                <tr key={o.id}>
                  <td className="b">{o.number}</td>
                  <td><span className={`tag ${["delivered", "cancelled", "awaiting_payment"].includes(o.stage) ? "line" : "lime"}`}>{stageLabel(o.stage)}</span></td>
                  <td>{o.eta || "—"}</td><td className="nowrap">{taka(o.total)}</td><td className="nowrap">{taka(Math.max(o.total - o.paid, 0))}</td>
                  <td className="r"><span className="row g8" style={{ justifyContent: "flex-end" }}><Link className="sbtn" href={`/order/${o.code}`}>Track</Link><Link className="sbtn" href={`/order/${o.code}/invoice`}>Invoice</Link></span></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </section>
    </Shell>
  );
}
