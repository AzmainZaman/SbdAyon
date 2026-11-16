/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { COUNTRIES } from "@/lib/config";
import { taka } from "@/lib/money";
import { addProduct, saveProduct } from "../../more-actions";

export default async function Catalogue({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams;
  const d = await db();
  const rows = await d.select().from(schema.products).orderBy(desc(schema.products.id)).limit(500);
  const editing = rows.find((r) => r.id === Number(edit));
  return (
    <>
      <h1 className="d" style={{ fontSize: 26 }}>Catalogue</h1>
      {editing ? (
        <form action={saveProduct.bind(null, editing.id)} className="card col g12">
          <span className="b">Edit product</span>
          <div className="grid">
            <div style={{ gridColumn: "1 / -1" }}><label className="lbl" htmlFor="name">Name</label><input id="name" name="name" className="inp sm" required defaultValue={editing.name} /></div>
            <div><label className="lbl" htmlFor="kind">Type</label><select id="kind" name="kind" className="inp sm" defaultValue={editing.kind}><option value="preorder">Pre-order</option><option value="instock">In stock (opens Ono)</option></select></div>
            <div><label className="lbl" htmlFor="country">Ships from</label><select id="country" name="country" className="inp sm" defaultValue={editing.country}>{COUNTRIES.map((c) => <option key={c}>{c}</option>)}</select></div>
            <div><label className="lbl" htmlFor="website">Store name</label><input id="website" name="website" className="inp sm" defaultValue={editing.website} /></div>
            <div><label className="lbl" htmlFor="price">Price ৳</label><input id="price" name="price" className="inp sm" defaultValue={editing.price || ""} /></div>
            <div style={{ gridColumn: "1 / -1" }}><label className="lbl" htmlFor="url">Link (store listing, or Ono page for in-stock)</label><input id="url" name="url" type="url" className="inp sm" defaultValue={editing.url} /></div>
            <div style={{ gridColumn: "1 / -1" }}><label className="lbl" htmlFor="imageUrl">Image link</label><input id="imageUrl" name="imageUrl" type="url" className="inp sm" defaultValue={editing.imageUrl} /></div>
            <div style={{ gridColumn: "1 / -1" }}><label className="lbl" htmlFor="description">Description</label><textarea id="description" name="description" className="inp" defaultValue={editing.description} /></div>
          </div>
          <label className="check"><input type="checkbox" name="visible" defaultChecked={editing.visible} />Show on the website</label>
          <div className="row g8"><button className="btn">Save product</button><button className="sbtn" name="intent" value="delete">Delete</button><Link className="sbtn" href="/admin/catalogue">Close</Link></div>
        </form>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))" }}>
          <form action={addProduct} className="card col g8">
            <label className="b" htmlFor="purl">Add a pre-order product</label>
            <input type="hidden" name="kind" value="preorder" />
            <div className="row g8"><input id="purl" name="url" type="url" required className="inp sm" style={{ flex: "1 1 200px", width: "auto" }} placeholder="Paste the store's product link" /><button className="btn" style={{ minHeight: 44 }}>Fetch</button></div>
            <span className="small mut">Name, photo and price are read where the store allows it. You check and publish it on the next screen.</span>
          </form>
          <form action={addProduct} className="card col g8">
            <label className="b" htmlFor="ourl">Add an in-stock product</label>
            <input type="hidden" name="kind" value="instock" />
            <div className="row g8"><input id="ourl" name="url" type="url" required className="inp sm" style={{ flex: "1 1 200px", width: "auto" }} placeholder="Paste the Ono product page link" /><button className="btn" style={{ minHeight: 44 }}>Add</button></div>
            <span className="small mut">Shown as &quot;In stock&quot;. The button on the site opens the Ono page.</span>
          </form>
        </div>
      )}
      <div className="tablebox"><table className="t" style={{ minWidth: 720 }}>
        <thead><tr><th>Photo</th><th>Product</th><th>Type</th><th>From</th><th>Price</th><th>On site</th><th></th></tr></thead>
        <tbody>
          {rows.length === 0 ? <tr><td colSpan={7} className="mut">No products yet. Add the first one above.</td></tr> : rows.map((r) => (
            <tr key={r.id}>
              <td>{r.imageUrl ? <img className="thumb" src={r.imageUrl} alt="" /> : <div className="thumb" aria-hidden="true" />}</td>
              <td className="b">{r.name}</td>
              <td><span className={`tag ${r.kind === "instock" ? "lime" : ""}`}>{r.kind === "instock" ? "In stock" : "Pre-order"}</span></td>
              <td>{r.kind === "instock" ? "Dhaka" : `${r.website} · ${r.country}`}</td>
              <td className="nowrap">{r.price ? taka(r.price) : "—"}</td>
              <td>{r.visible ? "Shown" : "Hidden"}</td>
              <td className="r"><Link className="sbtn" href={`/admin/catalogue?edit=${r.id}`}>Edit</Link></td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </>
  );
}
