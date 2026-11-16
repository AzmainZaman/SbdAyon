"use client";

import { useActionState } from "react";
import { loginStep, type LoginState } from "@/app/actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginStep, { step: "contact" });
  return (
    <form action={action} className="col g12" style={{ maxWidth: 440 }}>
      {state.step === "contact" ? (
        <>
          <h1 className="d" style={{ fontSize: 32 }}>Sign in</h1>
          <p className="mut">No password. We send a 6-digit code to your phone or email.</p>
          <div><label className="lbl" htmlFor="contact">Mobile number or email</label><input id="contact" name="contact" className="inp" required placeholder="01XXXXXXXXX or you@email.com" style={{ minHeight: 54 }} /></div>
        </>
      ) : (
        <>
          <h1 className="d" style={{ fontSize: 32 }}>Enter your code</h1>
          <p className="mut">We sent a 6-digit code to {state.contact}. It expires in 10 minutes.</p>
          <div><label className="lbl" htmlFor="code">6-digit code</label><input id="code" name="code" className="inp" required inputMode="numeric" autoComplete="one-time-code" maxLength={6} style={{ minHeight: 64, fontSize: 28, letterSpacing: "0.4em", textAlign: "center" }} /></div>
        </>
      )}
      {state.error ? <div className="notice bad" role="alert">{state.error}</div> : null}
      <button className="btn-lime" disabled={pending} style={{ minHeight: 54 }}>{pending ? "Please wait…" : state.step === "contact" ? "Send me a code" : "Verify and continue"}</button>
      {state.step === "code" ? <button className="sbtn" name="restart" value="1" formNoValidate style={{ alignSelf: "flex-start" }}>Use a different phone or email</button> : null}
      <span className="small mut">Ordered from SBD before? Use the same phone or email and your orders will be here.</span>
    </form>
  );
}
