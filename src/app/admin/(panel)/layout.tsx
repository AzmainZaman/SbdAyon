import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { logout } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="admin">
      <div className="admin-shell">
        <nav className="admin-nav">
          <div className="row g8" style={{ padding: "4px 14px 14px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/sbd-logo.png" alt="SBD" style={{ height: 22 }} /><span className="small b" style={{ letterSpacing: "0.08em" }}>ADMIN</span>
          </div>
          <Link href="/admin">Dashboard</Link>
          <Link href="/admin/quotes">Quotes</Link>
          <Link href="/admin/orders">Orders</Link>
          <Link href="/admin/shipments">Shipments</Link>
          <Link href="/admin/customers">Customers</Link>
          <Link href="/admin/catalogue">Catalogue</Link>
          <Link href="/admin/settings">Rates &amp; settings</Link>
          <Link href="/" target="_blank">View store ↗</Link>
          <form action={logout} style={{ padding: "8px 14px 0" }}><button className="sbtn">Sign out</button></form>
        </nav>
        <div className="admin-main">{children}</div>
      </div>
    </div>
  );
}
