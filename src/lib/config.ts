// Business settings that are not secret. Later these move to the admin "Rates & settings" page.

export const SITE = {
  name: "SBD Global Shopping",
  tagline: "#1 Global Shopping Platform in Bangladesh",
  url: process.env.SITE_URL ?? "http://localhost:3000",
  phone: "+8801776662300",
  whatsapp: "8801776662300",
  emailInfo: "info@sbd.com.bd",
  emailSupport: "support@sbd.com.bd",
  emailPayments: "payments@sbd.com.bd",
  address: "254 New Circular Road, Malibagh, Dhaka 1217",
  social: "@sbdshopping",
};

export const COUNTRIES = ["USA", "Europe", "UAE", "China", "Malaysia", "Thailand"] as const;

export const STAGES = [
  { key: "awaiting_payment", label: "Awaiting payment", tracked: false },
  { key: "confirmed", label: "Order confirmed", tracked: true },
  { key: "purchased", label: "Purchased from store", tracked: true },
  { key: "overseas_warehouse", label: "Arrived at overseas warehouse", tracked: true },
  { key: "in_transit", label: "In transit to Bangladesh", tracked: true },
  { key: "customs", label: "Customs clearance", tracked: true },
  { key: "dhaka", label: "Arrived at Dhaka office", tracked: true },
  { key: "ready", label: "Ready for pickup / out for delivery", tracked: true },
  { key: "delivered", label: "Delivered", tracked: true },
  { key: "cancelled", label: "Cancelled", tracked: false },
] as const;
export type StageKey = (typeof STAGES)[number]["key"];
export const stageLabel = (k: string) => STAGES.find((s) => s.key === k)?.label ?? k;

// Delivery charges come from Admin > Rates & settings.
export const RECEIVING = [
  { key: "pickup", label: "Pickup from SBD, Malibagh", desc: "Collect it yourself when it arrives", needsAddress: false },
  { key: "inside_dhaka", label: "Home delivery, inside Dhaka", desc: "After arrival in Dhaka", needsAddress: true },
  { key: "outside_dhaka", label: "Courier, outside Dhaka", desc: "After arrival in Dhaka", needsAddress: true },
] as const;
export type ReceivingKey = (typeof RECEIVING)[number]["key"];
export const receiving = (k: string) => RECEIVING.find((r) => r.key === k) ?? RECEIVING[0];

export const PAY_METHODS = [
  { key: "bkash", label: "bKash", desc: "Pay now from your bKash wallet" },
  { key: "sslcommerz", label: "Card, Nagad, Rocket or internet banking", desc: "Secure payment through SSLCommerz" },
  { key: "bank", label: "Instant bank transfer", desc: "NPSB, RTGS or bKash to Bank · confirmed after we verify" },
] as const;
export type PayMethod = (typeof PAY_METHODS)[number]["key"] | "manual";

export const BANK_ACCOUNTS = [
  { bank: "City Bank PLC", name: "SBD GLOBAL SHOPPING", number: "1254661102001", branch: "Mouchak Branch (Dhaka South)", routing: "225274361" },
  { bank: "Eastern Bank PLC", name: "SBD GLOBAL SHOPPING", number: "1141070001321", branch: "Shantinagar Branch (Dhaka South)", routing: "095276344" },
];

export const DEFAULTS = { taxPct: 9, servicePct: 10, quoteValidDays: 7 };
