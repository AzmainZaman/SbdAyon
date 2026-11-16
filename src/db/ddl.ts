// Creates the tables if they do not exist yet. Safe to run on every start.
export const DDL = `
CREATE TABLE IF NOT EXISTS customers (
  id serial PRIMARY KEY, name text NOT NULL DEFAULT '', phone text, email text,
  source text NOT NULL DEFAULT 'website', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS quotes (
  id serial PRIMARY KEY, number text NOT NULL UNIQUE, code text NOT NULL UNIQUE,
  customer_id integer, customer_name text NOT NULL DEFAULT '', customer_contact text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'Facebook', country text NOT NULL DEFAULT 'USA', status text NOT NULL DEFAULT 'draft',
  tax_pct numeric(6,2) NOT NULL DEFAULT 9, service_pct numeric(6,2) NOT NULL DEFAULT 10,
  shipping integer NOT NULL DEFAULT 0, discount integer NOT NULL DEFAULT 0,
  eta text NOT NULL DEFAULT '', valid_until text NOT NULL DEFAULT '',
  note_customer text NOT NULL DEFAULT '', note_internal text NOT NULL DEFAULT '', terms text NOT NULL DEFAULT '',
  change_request text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  viewed_at timestamptz, accepted_at timestamptz);
CREATE TABLE IF NOT EXISTS quote_lines (
  id serial PRIMARY KEY, quote_id integer NOT NULL, position integer NOT NULL DEFAULT 0, kind text NOT NULL DEFAULT 'item',
  name text NOT NULL DEFAULT '', website text NOT NULL DEFAULT '', url text NOT NULL DEFAULT '', image_url text NOT NULL DEFAULT '',
  qty integer NOT NULL DEFAULT 1, price integer NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS quote_lines_quote ON quote_lines (quote_id);
CREATE TABLE IF NOT EXISTS orders (
  id serial PRIMARY KEY, number text NOT NULL UNIQUE, code text NOT NULL UNIQUE, quote_id integer, customer_id integer,
  name text NOT NULL DEFAULT '', phone text NOT NULL DEFAULT '', email text NOT NULL DEFAULT '',
  receiving text NOT NULL DEFAULT 'pickup', address text NOT NULL DEFAULT '', district text NOT NULL DEFAULT '',
  delivery_charge integer NOT NULL DEFAULT 0, total integer NOT NULL DEFAULT 0, paid integer NOT NULL DEFAULT 0,
  stage text NOT NULL DEFAULT 'awaiting_payment', eta text NOT NULL DEFAULT '', eta_reason text NOT NULL DEFAULT '',
  note_customer text NOT NULL DEFAULT '', note_internal text NOT NULL DEFAULT '', show_serials boolean NOT NULL DEFAULT true,
  totals jsonb, tc_agreed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS order_items (
  id serial PRIMARY KEY, order_id integer NOT NULL, position integer NOT NULL DEFAULT 0, kind text NOT NULL DEFAULT 'item',
  name text NOT NULL DEFAULT '', website text NOT NULL DEFAULT '', url text NOT NULL DEFAULT '', image_url text NOT NULL DEFAULT '',
  qty integer NOT NULL DEFAULT 1, price integer NOT NULL DEFAULT 0, serials text NOT NULL DEFAULT '',
  store_order_no text NOT NULL DEFAULT '', tracking text NOT NULL DEFAULT '', cost integer NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS order_items_order ON order_items (order_id);
CREATE TABLE IF NOT EXISTS order_events (
  id serial PRIMARY KEY, order_id integer NOT NULL, stage text, note text NOT NULL DEFAULT '',
  visible boolean NOT NULL DEFAULT true, at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS order_events_order ON order_events (order_id);
CREATE TABLE IF NOT EXISTS payments (
  id serial PRIMARY KEY, order_id integer NOT NULL, method text NOT NULL, amount integer NOT NULL,
  status text NOT NULL DEFAULT 'pending', gateway_ref text NOT NULL DEFAULT '', trx_id text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '', raw jsonb, created_at timestamptz NOT NULL DEFAULT now(), paid_at timestamptz);
CREATE INDEX IF NOT EXISTS payments_order ON payments (order_id);
CREATE INDEX IF NOT EXISTS payments_ref ON payments (gateway_ref);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipment_id integer;
CREATE TABLE IF NOT EXISTS products (
  id serial PRIMARY KEY, kind text NOT NULL DEFAULT 'preorder', name text NOT NULL DEFAULT '', description text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT 'USA', website text NOT NULL DEFAULT '', url text NOT NULL DEFAULT '', image_url text NOT NULL DEFAULT '',
  price integer NOT NULL DEFAULT 0, visible boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS shipments (
  id serial PRIMARY KEY, name text NOT NULL DEFAULT '', country text NOT NULL DEFAULT 'USA', leaves text NOT NULL DEFAULT '',
  eta text NOT NULL DEFAULT '', stage text NOT NULL DEFAULT 'overseas_warehouse', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS otps (
  id serial PRIMARY KEY, contact text NOT NULL, code_hash text NOT NULL, attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL, used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS otps_contact ON otps (contact);
CREATE TABLE IF NOT EXISTS kv (key text PRIMARY KEY, value jsonb, updated_at timestamptz NOT NULL DEFAULT now());
-- Hosts like Supabase expose the public schema through a web API. Row-level security with no policies
-- blocks that API; the site itself connects as the table owner, which RLS does not restrict.
DO $$ DECLARE t text; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
`;
