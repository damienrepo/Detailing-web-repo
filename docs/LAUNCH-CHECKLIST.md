# Launch checklist

Things that need real information or a decision before the shop goes live.
Most of it is entered in the admin (`/admin`); shipping rules live in `shared/pricing.ts`.

## Business details (required by law for a webshop)

- [ ] In *Beheer → Bedrijfsgegevens*: official name, workshop address, phone, e-mail,
      KvK and btw number (shown in the footer and on the contact page), opening hours
- [ ] Sender address for e-mails (*Betalingen & e-mail*) — set up SPF/DKIM for that domain

## Products

- [ ] Prices for the cleaner, brush, towel and kit in *Beheer → Producten* (now € 16,95 / € 12,95 / € 7,95 / € 29,95)
- [ ] Product texts and claims: check every statement (e.g. "safe for leather",
      "matte finish", "wash at 40 °C") matches the real product
- [ ] Article numbers (SKU) and EAN codes if you have them
- [ ] Real product photos to replace the vector illustrations (upload them per product in the admin)
- [ ] Safety information: a cleaning product may need CLP hazard labelling and a
      safety data sheet (SDS) — check with the manufacturer/supplier

## Shipping & payment

- [ ] Shipping costs and free-shipping thresholds (`shared/pricing.ts`, now NL € 4,95 / free from € 40)
- [ ] Carrier and dispatch time (`shared/site.ts`, now PostNL, 1–2 working days)
- [ ] Mollie account approved, payment methods enabled, live key entered in *Beheer → Betalingen & e-mail*
      (test with a `test_` key first, then the `live_` key)

## Services

- [ ] From-prices, durations, on-location availability and FAQs in *Beheer → Diensten*
- [ ] Homepage hero photo (now an Unsplash photo) and the "Recent opgeleverd" captions in *Beheer → Homepage*

## Legal

- [ ] Have the terms, privacy policy and returns page checked (`src/pages/Legal.tsx`).
      They follow the usual structure for Dutch webshops but are not legal advice.
- [ ] Decide on the appointment cancellation policy (now: free until 48 hours before)

## Technical

- [ ] Hosting with persistent disk for `DATABASE_PATH`, and backups of that file
- [ ] `APP_URL` set to the real https domain (needed for Mollie webhooks and e-mails)
- [ ] `SECRET_KEY` set (`npm run secret`) and kept out of backups
- [ ] Admin account created with the setup code, two-factor authentication on
- [ ] SMTP and notification address set in the admin (use *Stuur een testmail*); place a test order and booking
- [ ] Submit `https://<domain>/sitemap.xml` in Google Search Console
- [ ] Create a Google Business Profile and link reviews (real reviews only)
