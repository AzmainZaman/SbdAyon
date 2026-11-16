import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { Shell } from "@/components/site";
import { currentCustomer } from "@/lib/session";
import { RequestForm } from "./form";

export const metadata: Metadata = { title: "Request a quote" };

export default async function RequestPage({ searchParams }: { searchParams: Promise<{ product?: string; sent?: string }> }) {
  const { product, sent } = await searchParams;
  const d = await db();
  const [p] = product ? await d.select().from(schema.products).where(eq(schema.products.id, Number(product) || 0)) : [];
  const contact = (await currentCustomer()) ?? "";
  return (
    <Shell>
      <div className="col g16" style={{ maxWidth: 720 }}>
        <h1 className="d" style={{ fontSize: 34 }}>Request a quote</h1>
        {sent ? (
          <>
            <div className="notice good" role="status">Thank you — we have your request. We will send your quote link by SMS, WhatsApp or email.</div>
            <Link className="btn-outline" href="/" style={{ alignSelf: "flex-start" }}>Back to the shop</Link>
          </>
        ) : (
          <>
            <p className="mut">Paste links from any overseas store. We reply with one price in taka, every charge listed, and a delivery date.</p>
            <RequestForm productId={p?.visible && p.kind === "preorder" ? p.id : undefined} productName={p?.name} contact={contact} />
          </>
        )}
      </div>
    </Shell>
  );
}
