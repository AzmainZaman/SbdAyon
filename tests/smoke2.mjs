// Second end-to-end run: storefront, settings, catalogue, manual order, shipments, Shopify import, invoice.
const base = "http://localhost:3111";
const code = process.argv[2];
let cookie = "";
const clean = (h) => h.replace(/<!-- -->/g, "");
const un = (s) => s.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const get = async (p, withCookie = true) => { const r = await fetch(base + p, { redirect: "manual", headers: withCookie ? { cookie } : {} }); return { status: r.status, loc: r.headers.get("location"), html: clean(await r.text()) }; };
function formAt(html, marker) { const at = html.indexOf(marker); if (at < 0) throw new Error("marker not found: " + marker); return html.slice(html.lastIndexOf("<form", at), html.indexOf("</form>", at)); }
/** Every field of the form with the value a browser would send if nothing was touched. */
function defaults(html, marker) {
  const form = formAt(html, marker); const out = [];
  for (const m of form.matchAll(/<input\b[^>]*>/g)) {
    const tag = m[0]; const name = /\bname="([^"]*)"/.exec(tag)?.[1]; if (!name) continue;
    const type = /\btype="([^"]*)"/.exec(tag)?.[1] ?? "text"; if (type === "file") continue;
    if ((type === "checkbox" || type === "radio") && !/\bchecked\b/.test(tag)) continue;
    out.push([name, un(/\bvalue="([^"]*)"/.exec(tag)?.[1] ?? (type === "checkbox" ? "on" : ""))]);
  }
  for (const m of form.matchAll(/<textarea\b[^>]*\bname="([^"]*)"[^>]*>([\s\S]*?)<\/textarea>/g)) out.push([m[1], un(m[2])]);
  for (const m of form.matchAll(/<select\b[^>]*\bname="([^"]*)"[^>]*>([\s\S]*?)<\/select>/g)) {
    const sel = /<option\b[^>]*\bselected[^>]*>/.exec(m[2])?.[0] ?? /<option\b[^>]*>/.exec(m[2])?.[0] ?? "";
    out.push([m[1], un(/\bvalue="([^"]*)"/.exec(sel)?.[1] ?? /<option\b[^>]*>([^<]*)/.exec(m[2])?.[1] ?? "")]);
  }
  return out;
}
const set = (fields, over) => { const keys = new Set(Object.keys(over)); return [...fields.filter(([k]) => !keys.has(k)), ...Object.entries(over).filter(([, v]) => v !== null)]; };
async function post(path, fields, withCookie = true) {
  const fd = new FormData(); for (const [k, v] of fields) fd.append(k, v);
  const r = await fetch(base + path, { method: "POST", body: fd, redirect: "manual", headers: withCookie ? { cookie } : {} });
  const sc = r.headers.get("set-cookie"); if (sc && sc.startsWith("sbd_admin=")) cookie = sc.split(";")[0];
  return { status: r.status, loc: r.headers.get("location"), html: clean(await r.text()) };
}
let fails = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };

for (const p of ["/", "/rates", "/help", "/terms", "/account", "/request", "/track"]) ok((await get(p)).status === 200, `page ${p} loads`);

let r = await get("/request");
let f = defaults(r.html, 'name="links"');
let p = await post("/request", set(f, { name: "Rahim", contact: "nonsense", links: "https://www.amazon.com/dp/B0TEST" }));
ok(p.status === 200 && p.html.includes("valid mobile number"), "quote request with a bad contact is refused");
p = await post("/request", set(f, { name: "Robot", contact: "01722222222", links: "https://x.example/a", website: "spam" }));
ok(p.status === 200, "robot-filled request is quietly dropped");
p = await post("/request", set(f, { name: "Rahim", contact: "01722222222", links: "https://www.amazon.com/dp/B0TEST\njavascript:alert(1)", note: "Blue one please" }));
ok(p.status === 303 && (p.loc ?? "").includes("sent=1"), "quote request is accepted");

// Admin actions must be closed to visitors who are not signed in.
r = await get("/admin/login");
const loginHidden = defaults(r.html, 'name="password"');
await post("/admin/login", set(loginHidden, { password: "smoke-test-password" }));
const adminCookie = cookie;
r = await get("/admin/settings");
const settingsForm = defaults(r.html, 'name="servicePct"');
p = await post("/admin/settings", set(settingsForm, { deliveryInside: "999" }), false);
ok(p.status >= 300 && p.status < 400 && (p.loc ?? "").includes("/admin/login"), "settings cannot be changed without signing in");
ok(!(await get("/rates")).html.includes("৳999"), "…and nothing changed");

r = await get("/admin/quotes");
ok(r.html.includes("New request") && r.html.includes("Rahim") && !r.html.includes(">Robot<"), "the request shows in admin as a new request; the robot's does not");
const reqId = Math.max(...[...r.html.matchAll(/href="\/admin\/quotes\/(\d+)"/g)].map((m) => Number(m[1])));
r = await get(`/admin/quotes/${reqId}`);
ok(r.html.includes("https://www.amazon.com/dp/B0TEST") && !r.html.includes("javascript:alert"), "request keeps the real link and drops the script link");

p = await post("/admin/settings", set(settingsForm, { deliveryInside: "120", deliveryOutside: "180", rate_USA: "120", ship_USA: "1500", days_USA: "15-20 days", next_USA: "5 December", termsPage: "Our terms.\n\nSecond paragraph.", hours: "10am-8pm" }));
ok(p.status === 303 && (p.loc ?? "").includes("saved=1"), "settings save");
r = await get("/rates");
ok(r.html.includes("15-20 days") && r.html.includes("৳1,500 per kg") && r.html.includes("৳120"), "rates page shows the new delivery time, rate and delivery charge");
ok((await get("/terms")).html.includes("Second paragraph."), "terms page shows the saved terms");
ok((await get(`/checkout/${code}`)).html.includes("৳120"), "checkout shows the delivery charge from settings");

r = await get("/admin/catalogue");
p = await post("/admin/catalogue", set(defaults(r.html, 'id="purl"'), { url: "http://127.0.0.1:3111/admin" }));
const editLoc = p.loc ?? "";
ok(p.status === 303 && editLoc.includes("edit="), "product can be added even when the link cannot be read");
r = await get(new URL(editLoc, base).pathname + new URL(editLoc, base).search);
ok(r.html.includes('value="New product"') && !r.html.includes("Payments to verify"), "link fetch did not read our own private admin page");
p = await post("/admin/catalogue", set(defaults(r.html, 'id="description"'), { name: "Scrapbook Album <i>Black</i>", price: "3359", visible: "on", website: "Amazon", url: "https://www.amazon.com/dp/B0ALBUM" }));
r = await get("/");
ok(r.html.includes("Scrapbook Album &lt;i&gt;Black&lt;/i&gt;") && r.html.includes("15-20 days") && r.html.includes("From the USA"), "home page shows the product in its country aisle with delivery time");
const pid = /href="\/p\/(\d+)"/.exec(r.html)?.[1];
r = await get(`/p/${pid}`);
ok(r.status === 200 && r.html.includes("Request a quote for this") && r.html.includes("৳3,359"), "product page loads");
ok((await get("/p/99999")).status === 404, "unknown product gives 404");

r = await get("/admin/quotes/1");
p = await post("/admin/quotes/1", set(defaults(r.html, 'name="payRef"'), { name: "Karim", phone: "01733333333", receiving: "inside_dhaka", address: "House 1, Road 2", district: "Dhaka", paid: "5000", payRef: "Cash" }));
ok(p.status === 303 && /\/admin\/orders\/\d+/.test(p.loc ?? ""), "staff can create an order from a quote by hand");
const oid = /orders\/(\d+)/.exec(p.loc)[1];
r = await get(`/admin/orders/${oid}`);
const orderCode = /\/order\/([a-z0-9]+)/.exec(r.html)?.[1];
let cust = await get(`/order/${orderCode}`, false);
ok(cust.html.includes("Payment needed") && cust.html.includes("Order confirmed") && cust.html.includes("House 1, Road 2"), "manual order shows the part-payment and still asks for the balance");
const inv = await get(`/order/${orderCode}/invoice`, false);
ok(inv.status === 200 && inv.html.includes("PARTLY PAID") && inv.html.includes("৳120") && inv.html.includes("Karim") && inv.html.includes("Gift wrap"), "invoice shows status, delivery charge, customer and charge line");
ok((await get("/order/zzzzzzzzzzzzzz/invoice", false)).status === 404, "invoice with a wrong code gives 404");

r = await get("/admin/shipments");
await post("/admin/shipments", set(defaults(r.html, 'name="leaves"'), { name: "USA December 1", leaves: "5 December", eta: "20-25 December" }));
r = await get("/admin/shipments");
ok(r.html.includes("USA December 1"), "shipment is created");
const shipId = /<option value="(\d+)">USA December 1/.exec(r.html)?.[1];
await post("/admin/shipments", [...defaults(r.html, 'name="shipmentId"').filter(([k]) => k.startsWith("$")), ["orderId", oid], ["shipmentId", shipId]]);
r = await get("/admin/shipments");
p = await post("/admin/shipments", set(defaults(r.html, 'name="reason"'), { stage: "customs", eta: "22-27 December", reason: "Flight delayed", notify: null }));
ok(p.status === 303 && (p.loc ?? "").includes("moved=1"), "moving the shipment updates its order");
cust = await get(`/order/${orderCode}`, false);
ok(cust.html.includes("Customs clearance") && cust.html.includes("22-27 December") && cust.html.includes("Flight delayed"), "customer sees the new stage, date and reason");

r = await get("/admin/customers");
const imp = defaults(r.html, 'name="customers"').filter(([k]) => k.startsWith("$"));
const customersCsv = 'First Name,Last Name,Email,Phone\nAyesha,"Khan, Jr",ayesha@example.com,+8801744444444\nAyesha,Khan,AYESHA@example.com,\n';
const ordersCsv = 'Name,Email,Financial Status,Fulfillment Status,Total,Lineitem quantity,Lineitem name,Lineitem price,Billing Name,Shipping Name,Shipping Phone,Notes,Created at\n#1001,ayesha@example.com,paid,fulfilled,2500.00,1,"Mug, large",1000.00,Ayesha Khan,Ayesha Khan,+8801744444444,"Line one\nline two",2026-01-05 10:00:00 +0600\n#1001,,,,,3,Spoon,500.00,,,,,\n#1002,ayesha@example.com,pending,,900.00,1,Cap,900.00,Ayesha Khan,Ayesha Khan,+8801744444444,,2026-02-01 10:00:00 +0600\n';
const mk = (cs, os) => { const fd = new FormData(); for (const [k, v] of imp) fd.append(k, v); fd.append("customers", new Blob([cs], { type: "text/csv" }), "customers_export.csv"); fd.append("orders", new Blob([os], { type: "text/csv" }), "orders_export.csv"); return fd; };
let ir = await fetch(base + "/admin/customers", { method: "POST", body: mk(customersCsv, ordersCsv), headers: { cookie }, redirect: "manual" });
let ih = clean(await ir.text());
ok(ih.includes("1 customers added") && ih.includes("2 orders added"), "Shopify import adds 1 customer (duplicate skipped) and 2 orders");
ir = await fetch(base + "/admin/customers", { method: "POST", body: mk(customersCsv, ordersCsv), headers: { cookie }, redirect: "manual" });
ih = clean(await ir.text());
ok(ih.includes("0 customers added") && ih.includes("0 orders added"), "running the import again adds nothing twice");
r = await get("/admin/orders");
ok(r.html.includes("SH-1001") && r.html.includes("SH-1002"), "imported orders appear with SH- numbers");
r = await get("/track");
p = await post("/track", set(defaults(r.html, 'name="number"'), { number: "sh-1001", phone: "01744444444" }), false);
ok(p.status === 303 && /\/order\/[a-z0-9]+$/.test(p.loc ?? ""), "customer can track an imported Shopify order with number + phone");
const old = await get(new URL(p.loc, base).pathname, false);
ok(old.html.includes("Mug, large") && old.html.includes("Delivered") && old.html.includes("৳2,500") && !old.html.includes("Payment needed"), "imported order shows items, delivered status and no payment request");
p = await post("/track", set(defaults(r.html, 'name="number"'), { number: "SH-1001", phone: "01700000000" }), false);
ok(p.status === 200 && p.html.includes("could not find"), "tracking with the wrong phone is refused");

r = await get("/account", false);
p = await post("/account", set(defaults(r.html, 'name="contact"'), { contact: "01744444444" }), false);
ok(p.status === 200 && p.html.includes("not switched on yet"), "sign-in says clearly when SMS is not set up, instead of failing silently");
void adminCookie;
console.log(fails ? `${fails} FAILED` : "ALL PASSED"); process.exitCode = fails ? 1 : 0;
