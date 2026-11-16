"use client";

import Link from "next/link";
import { useActionState } from "react";
import { trackLookup } from "@/app/actions";

export default function TrackPage() {
  const [state, action, pending] = useActionState(trackLookup, {});
  return (
    <main className="wrap col g16" style={{ paddingTop: 56, paddingBottom: 56, maxWidth: 520 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <Link href="/"><img src="/sbd-logo.png" alt="SBD Global Shopping home" style={{ height: 30 }} /></Link>
      <h1 className="d" style={{ fontSize: 32 }}>Track your order</h1>
      <form action={action} className="col g12">
        <div><label className="lbl" htmlFor="number">Order number</label><input id="number" name="number" className="inp" required placeholder="SBD-10001" /></div>
        <div><label className="lbl" htmlFor="phone">Phone number used for the order</label><input id="phone" name="phone" type="tel" className="inp" required placeholder="01XXXXXXXXX" /></div>
        {state.error ? <div className="notice bad" role="alert">{state.error}</div> : null}
        <button className="btn" disabled={pending}>{pending ? "Looking…" : "Track"}</button>
      </form>
    </main>
  );
}
