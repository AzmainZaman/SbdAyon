import { pgTable, serial, text, integer, numeric, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true });

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().default(""),
  phone: text("phone"),
  email: text("email"),
  source: text("source").notNull().default("website"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const quotes = pgTable("quotes", {
  id: serial("id").primaryKey(),
  number: text("number").notNull().unique(), // Q-1001
  code: text("code").notNull().unique(), // unguessable share-link code
  customerId: integer("customer_id"),
  customerName: text("customer_name").notNull().default(""),
  customerContact: text("customer_contact").notNull().default(""),
  source: text("source").notNull().default("Facebook"),
  country: text("country").notNull().default("USA"),
  status: text("status").notNull().default("draft"), // draft | sent | changes_requested | accepted | expired | cancelled
  taxPct: numeric("tax_pct", { precision: 6, scale: 2 }).notNull().default("9"),
  servicePct: numeric("service_pct", { precision: 6, scale: 2 }).notNull().default("10"),
  shipping: integer("shipping").notNull().default(0),
  discount: integer("discount").notNull().default(0),
  eta: text("eta").notNull().default(""),
  validUntil: text("valid_until").notNull().default(""),
  noteCustomer: text("note_customer").notNull().default(""),
  noteInternal: text("note_internal").notNull().default(""),
  terms: text("terms").notNull().default(""),
  changeRequest: text("change_request").notNull().default(""),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  viewedAt: ts("viewed_at"),
  acceptedAt: ts("accepted_at"),
});

export const quoteLines = pgTable("quote_lines", {
  id: serial("id").primaryKey(),
  quoteId: integer("quote_id").notNull(),
  position: integer("position").notNull().default(0),
  kind: text("kind").notNull().default("item"), // item | text | heading | charge
  name: text("name").notNull().default(""),
  website: text("website").notNull().default(""),
  url: text("url").notNull().default(""),
  imageUrl: text("image_url").notNull().default(""),
  qty: integer("qty").notNull().default(1),
  price: integer("price").notNull().default(0),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  number: text("number").notNull().unique(), // SBD-10001
  code: text("code").notNull().unique(), // unguessable tracking code
  quoteId: integer("quote_id"),
  customerId: integer("customer_id"),
  name: text("name").notNull().default(""),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  receiving: text("receiving").notNull().default("pickup"),
  address: text("address").notNull().default(""),
  district: text("district").notNull().default(""),
  deliveryCharge: integer("delivery_charge").notNull().default(0),
  total: integer("total").notNull().default(0),
  paid: integer("paid").notNull().default(0),
  stage: text("stage").notNull().default("awaiting_payment"),
  eta: text("eta").notNull().default(""),
  etaReason: text("eta_reason").notNull().default(""),
  noteCustomer: text("note_customer").notNull().default(""),
  noteInternal: text("note_internal").notNull().default(""),
  showSerials: boolean("show_serials").notNull().default(true),
  shipmentId: integer("shipment_id"),
  totals: jsonb("totals").$type<Record<string, number>>(),
  tcAgreedAt: ts("tc_agreed_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  position: integer("position").notNull().default(0),
  kind: text("kind").notNull().default("item"),
  name: text("name").notNull().default(""),
  website: text("website").notNull().default(""),
  url: text("url").notNull().default(""),
  imageUrl: text("image_url").notNull().default(""),
  qty: integer("qty").notNull().default(1),
  price: integer("price").notNull().default(0),
  serials: text("serials").notNull().default(""),
  storeOrderNo: text("store_order_no").notNull().default(""),
  tracking: text("tracking").notNull().default(""),
  cost: integer("cost").notNull().default(0),
});

export const orderEvents = pgTable("order_events", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  stage: text("stage"),
  note: text("note").notNull().default(""),
  visible: boolean("visible").notNull().default(true),
  at: ts("at").notNull().defaultNow(),
});

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  method: text("method").notNull(), // bkash | sslcommerz | bank | manual
  amount: integer("amount").notNull(),
  status: text("status").notNull().default("pending"), // pending | review | paid | failed | cancelled
  gatewayRef: text("gateway_ref").notNull().default(""), // bKash paymentID or SSLCommerz tran_id
  trxId: text("trx_id").notNull().default(""),
  note: text("note").notNull().default(""),
  raw: jsonb("raw"),
  createdAt: ts("created_at").notNull().defaultNow(),
  paidAt: ts("paid_at"),
});

export const kv = pgTable("kv", {
  key: text("key").primaryKey(),
  value: jsonb("value"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull().default("preorder"), // preorder | instock
  name: text("name").notNull().default(""),
  description: text("description").notNull().default(""),
  country: text("country").notNull().default("USA"),
  website: text("website").notNull().default(""),
  url: text("url").notNull().default(""), // store listing (pre-order) or Ono page (in stock)
  imageUrl: text("image_url").notNull().default(""),
  price: integer("price").notNull().default(0),
  visible: boolean("visible").notNull().default(true),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const shipments = pgTable("shipments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().default(""),
  country: text("country").notNull().default("USA"),
  leaves: text("leaves").notNull().default(""),
  eta: text("eta").notNull().default(""),
  stage: text("stage").notNull().default("overseas_warehouse"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const otps = pgTable("otps", {
  id: serial("id").primaryKey(),
  contact: text("contact").notNull(),
  codeHash: text("code_hash").notNull(),
  attempts: integer("attempts").notNull().default(0),
  expiresAt: ts("expires_at").notNull(),
  usedAt: ts("used_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
});
