// Pure cost estimate, shared by the server and the calculator in the browser.
export interface CountryRate { currency: string; rate: number; taxPct: number; shipPerKg: number; days: string; nextShipment: string; active: boolean }
export interface RateBook { countries: Record<string, CountryRate>; servicePct: number }

/** Rough landed-cost estimate, same order as a real quote. Returns null when a rate is missing. */
export function estimate(s: RateBook, country: string, priceForeign: number, weightKg: number) {
  const c = s.countries[country];
  if (!c || !c.active || c.rate <= 0) return null;
  const items = Math.round(priceForeign * c.rate);
  const tax = Math.round((items * c.taxPct) / 100);
  const service = Math.round(((items + tax) * s.servicePct) / 100);
  const shipping = Math.round(weightKg * c.shipPerKg);
  return { items, tax, service, shipping, total: items + tax + service + shipping, days: c.days, nextShipment: c.nextShipment, taxPct: c.taxPct, currency: c.currency };
}
