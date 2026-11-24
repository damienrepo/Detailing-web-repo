# Detail2Go — website & webshop

Website for Detail2Go (car detailing in Enschede) with service pages, a blog, a
webshop and an admin at `/admin` to manage all of it.

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

Without a Mollie key, development uses a fake payment page so the whole order
flow can be tested. E-mails are printed to the console until SMTP is configured.

### First admin account

On first start the server prints a one-time **setup code** in the terminal.
Open `/admin`, enter the code and create your account. After that the code is gone.

## Admin (`/admin`)

| Section               | What you can do                                                          |
| --------------------- | ------------------------------------------------------------------------ |
| Overzicht             | To-dos (orders to ship, new bookings) and a go-live checklist             |
| Statistieken          | Visitors, sources, pages, time on page, actions, funnels, single visits   |
| Bestellingen          | Mark orders as shipped (mails the customer), cancel, export to Excel      |
| Afspraken             | Booking requests and their status                                         |
| Blog                  | Write, schedule and publish posts (with photos and simple formatting)     |
| Producten             | Add, edit, reorder, hide or mark products sold out; build sets            |
| Diensten              | Edit texts, prices, photos and FAQs of every service, or hide one         |
| Homepage              | Hero, section texts, process steps, results photos, FAQ                   |
| Bedrijfsgegevens      | Phone, e-mail, address, hours, KvK/btw, social links                      |
| Afbeeldingen          | Media library; photos are resized and stripped of GPS data in the browser |
| Betalingen & e-mail   | Mollie key and SMTP settings, with "test" buttons                         |
| Account & beveiliging | Password, two-factor authentication, devices, activity log                |

Every content edit can be undone with *Standaard herstellen*, which returns to
the defaults in `shared/`.

### Security

- Passwords are hashed with scrypt. Sessions are random tokens in an `HttpOnly`,
  `SameSite=Strict` cookie (`Secure` on https), stored only as a hash, with a
  2-hour idle and 12-hour absolute timeout.
- Login is throttled per account and per IP, with the same error for unknown
  accounts and wrong passwords. Optional TOTP two-factor authentication.
- Admin requests must come from the site itself (Origin check plus a custom
  header), and admin responses are never cached.
- The Mollie key, mail password and 2FA secrets are encrypted with AES-256-GCM
  (`SECRET_KEY`) and never sent back to the browser.
- All edited content is validated on the server and rendered as text, never as
  HTML. Uploads must be real JPEGs and get random names.
- Every sign-in, failed attempt and change is in the activity log (never the
  secret values themselves).

### Statistics

The site measures its own visitors (`src/lib/analytics.ts` sends, `server/analytics.ts`
stores, `shared/analytics.ts` builds the report). Every visit is counted without
cookies: a visitor is recognised for one day by a hash with a salt that is replaced
every night, and IP addresses are never stored.

On top of that, a first-party HttpOnly cookie (`d2g_vid`, 13 months) recognises
returning visitors, so the dashboard can show who comes back, after how many visits
people book, and which channel first brought a customer in. Dutch visitors get it
without being asked (analytics cookies with little privacy impact are exempt under
Dutch law; the data stays on our server and is never shared); visitors from other
countries only after accepting cookies. Anyone can switch it off under
*Cookie-instellingen*, which also unlinks their earlier visits. The choices live in
`src/lib/consent.ts` (`d2g_stats` for statistics, `d2g_consent` for Meta).

Your own visits don't count while you're signed in to the admin; test in a private
window. Data older than 25 months is deleted automatically, and *Alle statistieken
wissen* clears it after testing.

### Locked out?

Run these on the server (they need access to the database):

```bash
npm run admin -- list
npm run admin -- reset-password jij@example.com   # prints a new random password
npm run admin -- disable-2fa jij@example.com
npm run admin -- logout-all jij@example.com
npm run admin -- create collega@example.com "Naam"
```

## Scripts

| Command         | What it does                                       |
| --------------- | -------------------------------------------------- |
| `npm run dev`   | Dev server with hot reload (API + site)            |
| `npm run build` | Build the site into `dist/`                        |
| `npm start`     | Run in production mode (serves `dist/` + the API)  |
| `npm test`      | Unit and API tests (Vitest)                        |
| `npm run lint`  | TypeScript type check                              |
| `npm run check` | All of the above, as run in CI                     |
| `npm run admin` | Account recovery on the server (see above)         |
| `npm run secret`| Generate a `SECRET_KEY`                            |

## Where things live

Products, services, homepage texts and company details are edited in the admin.
The files below hold the **defaults** the admin starts from.

| What                                     | File                       |
| ---------------------------------------- | -------------------------- |
| Default products                         | `shared/catalog.ts`        |
| Shipping costs and free-shipping limits  | `shared/pricing.ts`        |
| Default company details                  | `shared/site.ts`           |
| Default services                         | `shared/services.ts`       |
| Default homepage texts                   | `shared/content.ts`        |
| Validation of everything edited          | `shared/schemas.ts`        |
| Legal texts (terms, privacy, returns)    | `src/pages/Legal.tsx`      |
| Product illustrations                    | `src/components/ProductArt.tsx` |
| Colours and fonts                        | `src/index.css`            |
| E-mail texts                             | `server/emails.ts`         |

Prices are always recalculated on the server from the catalog it holds, so the
browser can never change what a customer pays.

## Order flow

1. The customer checks out on `/afrekenen`; the server validates the address,
   prices the cart and stores the order as `open`.
2. The customer pays on Mollie and returns to `/bestelling/<id>`.
3. Mollie calls `/api/webhooks/mollie`; the order becomes `paid` and the customer
   and shop (the notification address from the admin) receive an e-mail. The order page also checks the
   status itself, so it works even if the webhook is delayed.
4. In `/admin` you mark the order as shipped (optionally with a PostNL code); the
   customer gets a shipping e-mail with the track-and-trace link.

Booking requests from `/afspraak` are stored and e-mailed the same way and show
up in `/admin` under *Afspraken*.

## Estadio (estadio.detail2go.nl)

A separate booking page for the monthly wash days at Estadio Parkweg, served by
this same server on its own subdomain. People who work at Estadio pick a package
and a time and get a confirmation straight away; there is no request step.

- **Page:** `estadio.html` → `src/estadio/`. In development: http://localhost:3000/estadio
- **Server:** `server/estadio.ts` (API under `/api/estadio`, admin under `/api/admin/estadio`)
- **Rules and defaults:** `shared/estadio.ts` (packages, texts, time slots), `shared/estadioSchemas.ts` (validation)
- **Admin:** *Estadio* in the menu. Plan wash days (hours, break, cars at the same
  time), see the day plan per car with phone and plate, mark cars *Klaar*, move or
  cancel bookings, add phone bookings, export a day to Excel, and edit packages,
  prices (excl. btw) and texts.

Typing a Dutch number plate fills in brand, model and colour from the RDW's open
data (`opendata.rdw.nl`, no key needed). The lookup goes through our server
(`/api/estadio/voertuig/:plate`, cached for a day), so only the plate is sent to the
RDW, never the visitor's other details. If the RDW is down, the field stays editable.

**Google Calendar:** under *Estadio → Google Agenda* the admin connects a shared
Google Calendar through a Google service account (steps are on that screen). Every
booking then becomes an event (plate, name, package, phone; coloured per package),
updated when it moves and removed when it is cancelled. Writes happen in the
background (`server/googleCalendar.ts`, no Google SDK); failures are retried every
15 minutes and shown in the admin. The key is stored encrypted with `SECRET_KEY`.

Customers get a confirmation, a reminder the day before (from 10:00) and a link to
their own booking page, where they can add it to their calendar and move or cancel
it until a deadline set in the admin (24 hours by default). Two people can never
book the last spot: availability is checked again inside the database transaction.

**Going live:** add `estadio.detail2go.nl` as a custom domain on the same Railway
service and point a CNAME at it. The address follows `APP_URL`
(`https://www.detail2go.nl` → `https://estadio.detail2go.nl`); set `ESTADIO_URL` to
use another one. The admin itself stays on the main domain, and `/estadio` on the
main domain forwards to the subdomain.

## Deploy

The app is one Node process that needs **persistent disk** for the SQLite file.
Any host that runs Docker with a volume works (Fly.io, Railway, Render, a VPS).

```bash
docker build -t detail2go .
docker run -p 8080:8080 -v detail2go-data:/data --env-file .env detail2go
```

Set at least `APP_URL` (the public https URL) and `SECRET_KEY`, then create the
admin account with the setup code from the logs and enter Mollie and SMTP in the
admin. See `.env.example`. Back up the `/data` volume: it holds the database and
the uploaded images.

> Serverless hosts without persistent disk (for example Cloud Run without a
> mounted volume) lose the database on every restart. Use a volume there, or
> move the orders to a hosted database first.
