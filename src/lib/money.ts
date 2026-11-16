// All money is whole taka (integers). Percentages may have decimals.

export type LineKind = "item" | "text" | "heading" | "charge";

export interface CalcLine {
  kind: LineKind;
  qty: number;
  price: number; // taka per unit for items; signed amount for charge lines
}

export interface CalcInput {
  lines: CalcLine[];
  taxPct: number;
  servicePct: number;
  shipping: number;
  discount: number;
  deliveryCharge?: number;
}

export interface Totals {
  items: number;
  itemCount: number;
  tax: number;
  subtotal: number;
  service: number;
  shipping: number;
  extras: number;
  discount: number;
  delivery: number;
  total: number;
}

const round = (n: number) => Math.round(n + Number.EPSILON);

/**
 * Same order as the SBD Excel quotation:
 * items -> sales tax on items -> subtotal -> service charge on subtotal
 * -> shipping & import duty -> extra charge lines -> discount -> grand total.
 */
export function computeTotals(input: CalcInput): Totals {
  const itemLines = input.lines.filter((l) => l.kind === "item");
  const items = itemLines.reduce((s, l) => s + l.price * Math.max(l.qty, 0), 0);
  const itemCount = itemLines.reduce((s, l) => s + Math.max(l.qty, 0), 0);
  const tax = round((items * input.taxPct) / 100);
  const subtotal = items + tax;
  const service = round((subtotal * input.servicePct) / 100);
  const extras = input.lines.filter((l) => l.kind === "charge").reduce((s, l) => s + l.price, 0);
  const delivery = input.deliveryCharge ?? 0;
  const total = subtotal + service + input.shipping + extras - input.discount + delivery;
  return { items, itemCount, tax, subtotal, service, shipping: input.shipping, extras, discount: input.discount, delivery, total };
}

export function taka(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}৳${Math.abs(n).toLocaleString("en-US")}`;
}

/** Parses "1,399", "৳1399", " 1399.00 " -> 1399. Returns 0 for anything unreadable. */
export function parseTaka(v: unknown): number {
  const s = String(v ?? "").replace(/[^0-9.\-]/g, "");
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? round(n) : 0;
}

export function parsePct(v: unknown): number {
  const n = Number.parseFloat(String(v ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), 100) : 0;
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function below100(n: number): string {
  if (n < 20) return ONES[n];
  return [TENS[Math.floor(n / 10)], ONES[n % 10]].filter(Boolean).join(" ");
}
function below1000(n: number): string {
  const h = Math.floor(n / 100);
  return [h ? `${ONES[h]} Hundred` : "", below100(n % 100)].filter(Boolean).join(" ");
}

/** Bangladeshi numbering (Thousand, Lakh, Crore): 19500 -> "Nineteen Thousand Five Hundred Taka Only". */
export function takaInWords(amount: number): string {
  let n = Math.abs(round(amount));
  if (n === 0) return "Zero Taka Only";
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (crore) parts.push(`${crore >= 1000 ? takaInWords(crore).replace(" Taka Only", "") : below1000(crore)} Crore`);
  if (lakh) parts.push(`${below100(lakh)} Lakh`);
  if (thousand) parts.push(`${below100(thousand)} Thousand`);
  if (n) parts.push(below1000(n));
  return `${amount < 0 ? "Minus " : ""}${parts.join(" ")} Taka Only`;
}
