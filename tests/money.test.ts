import { describe, expect, it } from "vitest";
import { computeTotals, parseTaka, taka, takaInWords } from "@/lib/money";

const item = (price: number, qty = 1) => ({ kind: "item" as const, qty, price });

describe("computeTotals", () => {
  it("matches the SBD sample quotation line by line", () => {
    const t = computeTotals({
      lines: [1399, 1259, 1099, 1119, 1679, 3359, 1273].map((p) => item(p)),
      taxPct: 9, servicePct: 10, shipping: 6600, discount: 510,
    });
    expect(t.items).toBe(11187);
    expect(t.tax).toBe(1007);
    expect(t.subtotal).toBe(12194);
    expect(t.service).toBe(1219);
    expect(t.total).toBe(12194 + 1219 + 6600 - 510);
  });
  it("ignores text and heading lines, adds charge lines, multiplies quantity", () => {
    const t = computeTotals({
      lines: [item(100, 3), { kind: "text", qty: 1, price: 999 }, { kind: "heading", qty: 1, price: 999 }, { kind: "charge", qty: 1, price: 50 }, { kind: "charge", qty: 1, price: -20 }],
      taxPct: 0, servicePct: 0, shipping: 0, discount: 0, deliveryCharge: 80,
    });
    expect(t.items).toBe(300);
    expect(t.itemCount).toBe(3);
    expect(t.extras).toBe(30);
    expect(t.total).toBe(410);
  });
});

describe("formatting", () => {
  it("writes taka amounts in words the Bangladeshi way", () => {
    expect(takaInWords(19500)).toBe("Nineteen Thousand Five Hundred Taka Only");
    expect(takaInWords(0)).toBe("Zero Taka Only");
    expect(takaInWords(105)).toBe("One Hundred Five Taka Only");
    expect(takaInWords(250000)).toBe("Two Lakh Fifty Thousand Taka Only");
    expect(takaInWords(12345678)).toBe("One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Taka Only");
  });
  it("formats and parses taka", () => {
    expect(taka(19500)).toBe("৳19,500");
    expect(taka(-510)).toBe("-৳510");
    expect(parseTaka("৳1,399")).toBe(1399);
    expect(parseTaka("abc")).toBe(0);
  });
});
