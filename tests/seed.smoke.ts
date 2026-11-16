import { it } from "vitest";
import { createQuote, saveQuote } from "@/lib/store";
it("seeds", async () => {
const q = await createQuote({ customerName: "Smoke Test", customerContact: "01711111111" });
await saveQuote(q.id, { shipping: 6600, discount: 510, status: "sent", eta: "10-17 December" }, [
  { kind: "heading", name: "From Amazon USA", website: "", url: "", imageUrl: "", qty: 1, price: 0 },
  { kind: "item", name: "Rubber Stamp Letters", website: "Amazon", url: "https://www.amazon.com/x", imageUrl: "", qty: 1, price: 1399 },
  { kind: "item", name: "Corner Punch <b>Pink</b>", website: "Amazon", url: "", imageUrl: "", qty: 2, price: 1259 },
  { kind: "text", name: "Colour: pink", website: "", url: "", imageUrl: "", qty: 1, price: 0 },
  { kind: "charge", name: "Gift wrap", website: "", url: "", imageUrl: "", qty: 1, price: 100 },
]);
(await import("node:fs")).writeFileSync(".data/code.txt", q.code);
});
