// Everything SBD can change from Admin > Rates & settings. Stored as one record in the database.
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { COUNTRIES } from "./config";

import type { CountryRate } from "./estimate";
export type { CountryRate };
export interface Settings {
  countries: Record<string, CountryRate>;
  servicePct: number;
  deliveryInside: number;
  deliveryOutside: number;
  quoteValidDays: number;
  quoteTerms: string;
  termsPage: string;
  refundPage: string;
  hours: string;
}

const CUR: Record<string, string> = { USA: "USD", Europe: "EUR", UAE: "AED", China: "CNY", Malaysia: "MYR", Thailand: "THB" };

export function defaultSettings(): Settings {
  return {
    countries: Object.fromEntries(COUNTRIES.map((c) => [c, { currency: CUR[c], rate: 0, taxPct: c === "USA" ? 9 : 0, shipPerKg: 0, days: "", nextShipment: "", active: true }])),
    servicePct: 10,
    deliveryInside: Number(process.env.DELIVERY_INSIDE_DHAKA ?? 0),
    deliveryOutside: Number(process.env.DELIVERY_OUTSIDE_DHAKA ?? 0),
    quoteValidDays: 7,
    quoteTerms: "",
    termsPage: "",
    refundPage: "",
    hours: "",
  };
}

const KEY = "settings";

export async function getSettings(): Promise<Settings> {
  const d = await db();
  const [row] = await d.select().from(schema.kv).where(eq(schema.kv.key, KEY));
  const def = defaultSettings();
  const saved = (row?.value ?? {}) as Partial<Settings>;
  const countries = { ...def.countries };
  for (const c of Object.keys(countries)) countries[c] = { ...countries[c], ...(saved.countries?.[c] ?? {}) };
  return { ...def, ...saved, countries };
}

export async function saveSettings(value: Settings): Promise<void> {
  const d = await db();
  await d.insert(schema.kv).values({ key: KEY, value }).onConflictDoUpdate({ target: schema.kv.key, set: { value, updatedAt: new Date() } });
}

export const deliveryCharge = (s: Settings, receivingKey: string) => (receivingKey === "inside_dhaka" ? s.deliveryInside : receivingKey === "outside_dhaka" ? s.deliveryOutside : 0);

export { estimate } from "./estimate";
