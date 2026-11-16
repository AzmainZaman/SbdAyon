// Reads a product page and pulls out its name, photo and price where the store allows it.
// Only called by signed-in staff. Guards: public http(s) addresses only, short timeout, size cap.
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export interface Fetched { name: string; imageUrl: string; price: number; currency: string; website: string; ok: boolean; reason?: string }

function isPrivate(ip: string): boolean {
  if (ip.includes(":")) { const v = ip.toLowerCase(); return v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("::ffff:"); }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  const u = new URL(raw);
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("Only http and https links are allowed");
  if (u.username || u.password) throw new Error("Links with a username are not allowed");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  const ips = isIP(host) ? [host] : (await lookup(host, { all: true })).map((r) => r.address);
  if (!ips.length || ips.some(isPrivate)) throw new Error("That address is not a public website");
  return u;
}

const meta = (html: string, key: string): string => {
  const re = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${key}["'][^>]*>`, "i");
  const tag = re.exec(html)?.[0] ?? "";
  return (/content=["']([^"']*)["']/i.exec(tag)?.[1] ?? "").trim();
};
const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();

export function websiteName(u: URL): string {
  const parts = u.hostname.replace(/^www\./, "").split(".");
  const core = parts.length > 2 && parts[parts.length - 2].length <= 3 ? parts[parts.length - 3] : parts[parts.length - 2] ?? parts[0];
  return core.charAt(0).toUpperCase() + core.slice(1);
}

export function parseProduct(html: string, u: URL): Fetched {
  const title = meta(html, "og:title") || meta(html, "twitter:title") || (/<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1] ?? "");
  let image = meta(html, "og:image") || meta(html, "twitter:image");
  if (image) { try { image = new URL(decode(image), u).toString(); } catch { image = ""; } }
  if (!/^https?:\/\//i.test(image)) image = "";
  let price = meta(html, "product:price:amount") || meta(html, "og:price:amount") || meta(html, "price");
  let currency = meta(html, "product:price:currency") || meta(html, "og:price:currency") || meta(html, "priceCurrency");
  if (!price) { const m = /"price"\s*:\s*"?(\d+(?:\.\d+)?)"?/.exec(html); if (m) price = m[1]; }
  if (!currency) { const m = /"priceCurrency"\s*:\s*"([A-Z]{3})"/.exec(html); if (m) currency = m[1]; }
  const name = decode(title).slice(0, 300);
  return { name, imageUrl: image.slice(0, 2000), price: Number.parseFloat(price) || 0, currency: currency.slice(0, 3).toUpperCase(), website: websiteName(u), ok: Boolean(name) };
}

export async function fetchProduct(raw: string): Promise<Fetched> {
  let u: URL;
  try { u = await assertPublicUrl(raw); } catch (e) { return { name: "", imageUrl: "", price: 0, currency: "", website: "", ok: false, reason: (e as Error).message }; }
  const empty = { name: "", imageUrl: "", price: 0, currency: "", website: websiteName(u), ok: false };
  try {
    // redirect: "manual" so a public page cannot bounce us to a private address.
    const res = await fetch(u, { redirect: "manual", signal: AbortSignal.timeout(8000), headers: { "user-agent": "Mozilla/5.0 (compatible; SBD-quote-helper)", accept: "text/html" }, cache: "no-store" });
    if (res.status >= 300 && res.status < 400) return { ...empty, reason: "The store redirected the request. Fill in the details by hand." };
    if (!res.ok) return { ...empty, reason: `The store did not allow automatic reading (code ${res.status}). Fill in the details by hand.` };
    const reader = res.body?.getReader();
    let html = ""; const dec = new TextDecoder();
    while (reader && html.length < 600_000) { const { done, value } = await reader.read(); if (done) break; html += dec.decode(value, { stream: true }); }
    await reader?.cancel().catch(() => undefined);
    const p = parseProduct(html, u);
    return p.ok ? p : { ...empty, reason: "Could not read the product details from that page. Fill them in by hand." };
  } catch {
    return { ...empty, reason: "The store did not answer in time. Fill in the details by hand." };
  }
}
