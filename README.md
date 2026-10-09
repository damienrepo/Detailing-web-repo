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
