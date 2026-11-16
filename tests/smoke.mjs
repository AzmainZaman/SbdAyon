// Drives the built site like a customer with JavaScript switched off: reads each form and posts it back.
const base = "http://localhost:3111";
const code = process.argv[2];
let cookie = "";
const clean = (h) => h.replace(/<!-- -->/g, "");
const get = async (p) => { const r = await fetch(base + p, { redirect: "manual", headers: { cookie } }); return { status: r.status, loc: r.headers.get("location"), html: clean(await r.text()) }; };
function formFields(html, marker) {
  const at = html.indexOf(marker); if (at < 0) throw new Error("marker not found: " + marker);
  const start = html.lastIndexOf("<form", at); const end = html.indexOf("</form>", at);
  const form = html.slice(start, end); const out = [];
  for (const m of form.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) { const n = /name="([^"]*)"/.exec(m[0]); const v = /value="([^"]*)"/.exec(m[0]); if (n) out.push([n[1], (v?.[1] ?? "").replace(/&quot;/g, '"').replace(/&amp;/g, "&")]); }
  return out;
}
async function post(path, fields) {
  const fd = new FormData(); for (const [k, v] of fields) fd.append(k, v);
  const r = await fetch(base + path, { method: "POST", body: fd, redirect: "manual", headers: { cookie } });
  const set = r.headers.get("set-cookie"); if (set) cookie = set.split(";")[0];
  return { status: r.status, loc: r.headers.get("location"), html: clean(await r.text()) };
}
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };

let r = await get(`/q/${code}`);
ok(r.status === 200 && r.html.includes("Rubber Stamp Letters") && r.html.includes("From Amazon USA"), "quote link shows items and heading");
ok(r.html.includes("Corner Punch &lt;b&gt;Pink&lt;/b&gt;") && !r.html.includes("<b>Pink</b>"), "product names are escaped, not run as HTML");
ok(r.html.includes("Gift wrap") && r.html.includes("10-17 December"), "quote shows charge line and delivery estimate");
ok((await get("/q/doesnotexist")).status === 404, "unknown quote code gives 404");

r = await get(`/checkout/${code}`);
ok(r.status === 200 && r.html.includes("Terms &amp; Conditions"), "checkout page loads with the T&C box");
const hidden = formFields(r.html, 'name="agree"');
const good = [["name", "Smoke Test"], ["phone", "01711111111"], ["email", ""], ["receiving", "pickup"], ["note", "gift"], ["payMethod", "bank"]];
let p = await post(`/checkout/${code}`, [...hidden, ...good]);
ok(p.status === 200 && p.html.includes("agree to the Terms"), "checkout without the T&C tick is refused");
p = await post(`/checkout/${code}`, [...hidden, ...good.filter((f) => f[0] !== "phone"), ["phone", "12345"], ["agree", "on"]]);
ok(p.status === 200 && p.html.includes("valid Bangladeshi mobile"), "bad phone number is refused");
p = await post(`/checkout/${code}`, [...hidden, ...good, ["agree", "on"]]);
ok(p.status === 303 && /\/order\/[a-z0-9]+$/.test(p.loc ?? ""), "bank-transfer checkout creates an order and redirects to it: " + p.loc);
const orderPath = new URL(p.loc, base).pathname;

r = await get(orderPath);
ok(r.html.includes("Complete your bank transfer") && r.html.includes("1254661102001") && r.html.includes("1141070001321"), "order page shows both bank accounts");
ok(r.html.includes("Awaiting payment"), "order starts as awaiting payment");
p = await post(`/checkout/${code}`, [...hidden, ...good, ["agree", "on"]]);
ok(p.status >= 300 && p.status < 400 && (p.loc ?? "").includes(`/q/${code}`), "posting the same checkout again is turned away");
p = await post(orderPath, [...formFields(r.html, 'name="reference"'), ["reference", "Sender: Smoke Test, TRX 998877"]]);
ok(p.status === 303 && (p.loc ?? "").includes("proof=sent"), "customer can report the transfer");
r = await get(orderPath);
ok(r.html.includes("verifying the payment"), "order page says the transfer is being verified");

r = await get("/admin");
ok(r.status === 307 && (r.loc ?? "").includes("/admin/login"), "admin is closed without signing in");
r = await get("/admin/login");
p = await post("/admin/login", [...formFields(r.html, 'name="password"'), ["password", "wrong-password"]]);
ok(!p.loc && p.html.includes("Wrong password"), "wrong admin password is refused");
p = await post("/admin/login", [...formFields(r.html, 'name="password"'), ["password", "smoke-test-password"]]);
ok(p.status === 303 && cookie.startsWith("sbd_admin="), "admin signs in with the right password");
r = await get("/admin");
ok(r.status === 200 && r.html.includes("Payments to verify") && r.html.includes("TRX 998877"), "dashboard lists the transfer to verify");
const orderId = /\/admin\/orders\/(\d+)/.exec(r.html)?.[1];
ok(new Set([...(await get("/admin/orders")).html.matchAll(/href="\/admin\/orders\/(\d+)"/g)].map((m) => m[1])).size === 1, "only one order exists after the repeat attempt");
r = await get(`/admin/orders/${orderId}`);
const verifyBtn = /value="(verify:\d+)"/.exec(r.html)?.[1];
p = await post(`/admin/orders/${orderId}`, [...formFields(r.html, verifyBtn), ["intent", verifyBtn]]);
ok(Boolean(verifyBtn) && p.status === 303, "staff verifies the bank transfer");
r = await get(orderPath);
ok(r.html.includes("Order confirmed") && !r.html.includes("Complete your bank transfer") && r.html.includes("Paid by bank transfer") && />Balance due<\/span><span class="b">৳0</.test(r.html), "customer's order is confirmed, shows the payment and a zero balance");
r = await get(`/admin/orders/${orderId}`);
p = await post(`/admin/orders/${orderId}`, [...formFields(r.html, 'name="stage"'), ["stage", "in_transit"], ["stageNote", ""], ["intent", "stage"]]);
r = await get(orderPath);
ok(r.html.includes("In transit to Bangladesh"), "stage change shows on the customer's tracking page");

const ipn = await fetch(base + "/api/pay/sslcommerz/ipn", { method: "POST", body: new URLSearchParams({ tran_id: "FAKE-1", val_id: "x", status: "VALID" }) });
ok(ipn.status === 200 && (await ipn.text()) === "unknown transaction", "forged SSLCommerz notice for an unknown payment changes nothing");
const cb = await fetch(base + "/api/pay/bkash/callback?paymentID=FAKE&status=success", { redirect: "manual" });
ok(cb.status === 303 && (cb.headers.get("location") ?? "").endsWith("/track"), "forged bKash callback for an unknown payment changes nothing");
