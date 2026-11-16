"use client";

import { useActionState } from "react";
import { importShopify } from "../../more-actions";

export function ImportForm() {
  const [state, action, pending] = useActionState(importShopify, {});
  return (
    <form action={action} className="card col g12">
      <span className="b">Import from Shopify</span>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))" }}>
        <div><label className="lbl" htmlFor="customers">1 · Customers CSV (customers_export.csv)</label><input id="customers" name="customers" type="file" accept=".csv,text/csv" className="inp sm" style={{ padding: 8 }} /></div>
        <div><label className="lbl" htmlFor="orders">2 · Orders CSV (orders_export.csv)</label><input id="orders" name="orders" type="file" accept=".csv,text/csv" className="inp sm" style={{ padding: 8 }} /></div>
      </div>
      <span className="small mut">Safe to run again: customers already here (same phone or email) and orders already imported are skipped. Shopify order #1001 becomes SH-1001, so customers can track old orders with that number and their phone.</span>
      {state.message ? <div className="notice good" role="status">{state.message}</div> : null}
      <button className="btn" disabled={pending} style={{ alignSelf: "flex-start" }}>{pending ? "Importing…" : "Import"}</button>
    </form>
  );
}
