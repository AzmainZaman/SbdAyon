import type { Metadata } from "next";
import { Shell } from "@/components/site";
import { SITE } from "@/lib/config";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Terms & Conditions" };
export const dynamic = "force-dynamic";

const Paras = ({ text }: { text: string }) => <>{text.split(/\n\s*\n/).map((p, i) => <p key={i} style={{ whiteSpace: "pre-line", maxWidth: 760 }}>{p}</p>)}</>;

export default async function Terms() {
  const s = await getSettings();
  const missing = <p className="mut">This page is being prepared. Please contact {SITE.emailSupport} for the current terms.</p>;
  return (
    <Shell>
      <h1 className="d" style={{ fontSize: 32 }}>Terms &amp; Conditions</h1>
      {s.termsPage ? <Paras text={s.termsPage} /> : missing}
      <h2 id="refund" className="d" style={{ fontSize: 22 }}>Refund policy</h2>
      {s.refundPage ? <Paras text={s.refundPage} /> : missing}
    </Shell>
  );
}
