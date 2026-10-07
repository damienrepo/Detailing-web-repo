# Launch checklist

Things that need real information or a decision before the shop goes live.
Most values are in `shared/site.ts`, `shared/catalog.ts`, `shared/pricing.ts`
and `shared/services.ts`.

## Business details (required by law for a webshop)

- [ ] Brand name: the site uses **Lumen** from the original design. Change `name`,
      `fullName` and `legalName` in `shared/site.ts` if the business name differs
      (also the wordmark in the product illustrations, `index.html` and `public/og-image.png`).
- [ ] Official company name, visiting address, phone and e-mail
- [ ] KvK number and btw-identification number (shown in the footer and on the contact page)
- [ ] Opening hours, Instagram and Facebook links
- [ ] E-mail address used as sender (`MAIL_FROM`) — set up SPF/DKIM for that domain

## Products

- [ ] Prices for the cleaner, brush, towel and kit (now € 16,95 / € 12,95 / € 7,95 / € 29,95)
- [ ] Product texts and claims: check every statement (e.g. "safe for leather",
      "matte finish", "wash at 40 °C") matches the real product
- [ ] Article numbers (SKU) and EAN codes if you have them
- [ ] Real product photos to replace the vector illustrations
      (`src/components/ProductArt.tsx` → `ProductImage`)
- [ ] Safety information: a cleaning product may need CLP hazard labelling and a
      safety data sheet (SDS) — check with the manufacturer/supplier

## Shipping & payment

- [ ] Shipping costs and free-shipping thresholds (`shared/pricing.ts`, now NL € 4,95 / free from € 40)
- [ ] Carrier and dispatch time (`shared/site.ts`, now PostNL, 1–2 working days)
- [ ] Mollie account approved, payment methods enabled, `MOLLIE_API_KEY` set
      (test with a `test_` key first, then the `live_` key)

## Studio services

- [ ] From-prices, durations and what is included (`shared/services.ts`)
- [ ] Photos of your own work for the services and "Recent opgeleverd" sections
      (the current Unsplash photos and the Porsche/Audi captions are placeholders)

## Legal

- [ ] Have the terms, privacy policy and returns page checked (`src/pages/Legal.tsx`).
      They follow the usual structure for Dutch webshops but are not legal advice.
- [ ] Decide on the appointment cancellation policy (now: free until 48 hours before)

## Technical

- [ ] Hosting with persistent disk for `DATABASE_PATH`, and backups of that file
- [ ] `APP_URL` set to the real https domain (needed for Mollie webhooks and e-mails)
- [ ] Strong `ADMIN_PASSWORD`
- [ ] SMTP configured and `NOTIFY_EMAIL` set; place a test order and booking
- [ ] Submit `https://<domain>/sitemap.xml` in Google Search Console
- [ ] Create a Google Business Profile and link reviews (real reviews only)
