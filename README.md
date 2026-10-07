# Lumen Detailing — website & webshop

Website for the detailing studio with a webshop for the interior care products
(Interior Cleaner, Interior Detailing Brush, microfiber towel and the Interior
Care Kit bundle).

- **Frontend:** React 19, React Router, Tailwind CSS 4, Vite
- **Backend:** Express (same process), SQLite (better-sqlite3)
- **Payments:** [Mollie](https://www.mollie.com) (iDEAL, Bancontact, credit card)
- **E-mail:** any SMTP provider (order confirmation, shipping and booking mails)

Before going live, work through [`docs/LAUNCH-CHECKLIST.md`](docs/LAUNCH-CHECKLIST.md).

## Run locally

Requires Node.js 22+.

```bash
npm install
cp .env.example .env    # optional: everything works without it in development
npm run dev             # http://localhost:3000
```

Without a `MOLLIE_API_KEY`, development uses a fake payment page so the whole
order flow can be tested. E-mails are printed to the console unless SMTP is
configured. Set `ADMIN_PASSWORD` to use the admin page at `/admin`.

## Scripts

| Command         | What it does                                       |
| --------------- | -------------------------------------------------- |
| `npm run dev`   | Dev server with hot reload (API + site)            |
| `npm run build` | Build the site into `dist/`                        |
| `npm start`     | Run in production mode (serves `dist/` + the API)  |
| `npm test`      | Unit and API tests (Vitest)                        |
| `npm run lint`  | TypeScript type check                              |
| `npm run check` | All of the above, as run in CI                     |

## Where things live

| What                                     | File                       |
| ---------------------------------------- | -------------------------- |
| Products, prices, descriptions, stock    | `shared/catalog.ts`        |
| Shipping costs and free-shipping limits  | `shared/pricing.ts`        |
| Company details, KvK, btw, hours, social | `shared/site.ts`           |
| Studio services and from-prices          | `shared/services.ts`       |
| Legal texts (terms, privacy, returns)    | `src/pages/Legal.tsx`      |
| Product illustrations                    | `src/components/ProductArt.tsx` |
| Colours and fonts                        | `src/index.css`            |
| E-mail texts                             | `server/emails.ts`         |

Prices are always recalculated on the server from `shared/catalog.ts`, so the
browser can never change what a customer pays. To mark a product as sold out,
set `inStock: false`.

## Order flow

1. The customer checks out on `/afrekenen`; the server validates the address,
   prices the cart and stores the order as `open`.
2. The customer pays on Mollie and returns to `/bestelling/<id>`.
3. Mollie calls `/api/webhooks/mollie`; the order becomes `paid` and the customer
   and shop (`NOTIFY_EMAIL`) receive an e-mail. The order page also checks the
   status itself, so it works even if the webhook is delayed.
4. In `/admin` you mark the order as shipped (optionally with a PostNL code); the
   customer gets a shipping e-mail with the track-and-trace link.

Booking requests from `/afspraak` are stored and e-mailed the same way and show
up in `/admin` under *Afspraakaanvragen*.

## Deploy

The app is one Node process that needs **persistent disk** for the SQLite file.
Any host that runs Docker with a volume works (Fly.io, Railway, Render, a VPS).

```bash
docker build -t lumen .
docker run -p 8080:8080 -v lumen-data:/data --env-file .env lumen
```

Set at least `APP_URL` (the public https URL), `MOLLIE_API_KEY`,
`ADMIN_PASSWORD`, the `SMTP_*` settings and `NOTIFY_EMAIL`. See `.env.example`.

> Serverless hosts without persistent disk (for example Cloud Run without a
> mounted volume) lose the database on every restart. Use a volume there, or
> move the orders to a hosted database first.
