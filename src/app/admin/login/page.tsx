"use client";

import { useActionState } from "react";
import { login } from "../actions";

export default function AdminLogin() {
  const [state, action, pending] = useActionState(login, {});
  return (
    <main className="wrap col g16" style={{ paddingTop: 80, maxWidth: 420 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/sbd-logo.png" alt="SBD" style={{ height: 30, alignSelf: "flex-start" }} />
      <h1 className="d" style={{ fontSize: 28 }}>Admin sign in</h1>
      <form action={action} className="col g12">
        <div><label className="lbl" htmlFor="password">Admin password</label><input id="password" name="password" type="password" className="inp" required autoComplete="current-password" /></div>
        {state.error ? <div className="notice bad" role="alert">{state.error}</div> : null}
        <button className="btn" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
      </form>
    </main>
  );
}
