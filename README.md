# SBD Global Shopping — website

Pre-order website for sbd.com.bd. Built with Next.js and a Postgres database.

## What is in this version

Customer side
- Home with country tiles (delivery time, next shipment), product aisles per country and in-stock items that open on Ono.
- Product pages, quote request form (paste links), cost calculator and delivery times, help / FAQ / contact, Terms & Conditions.
- Shared quote link (`/q/<code>`), checkout (pickup / inside Dhaka / outside Dhaka; bKash / SSLCommerz / bank transfer; order note; required T&C tick).
- Order page with tracking stages, delivery estimate, payments and pay-again; printable invoice; track by order number + phone.
- Account: passwordless sign-in with a 6-digit code by email or SMS (needs SMTP or an SMS gateway switched on).

Admin (`/admin`)
- Dashboard, quote builder (items, text lines, headings, charge lines, fetch by link, share link), manual order creation from a quote.
- Orders (stages, delivery estimate, verify bank transfers, manual payments, serial numbers), shipments (move many orders at once).
- Catalogue, customers, Shopify CSV import, rates & settings.

## Not built yet

Payment-proof file upload (customers type the transfer reference instead), Bangla, per-staff logins, reports, WhatsApp sending from the site (share buttons open WhatsApp instead).

## Commands

    npm install
    npm run dev        # run locally at http://localhost:3000 (uses a throwaway local database)
    npm test           # unit tests
    npm run build      # production build

Settings are listed in `.env.example`.
