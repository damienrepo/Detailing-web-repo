# SEO-plan Detail2Go

Het plan om de (lokale) vindbaarheid van detail2go.nl sterk te verbeteren: eerst het technische fundament,
daarna features die de SEO over tijd vanzelf blijven verbeteren. Alle punten zijn goedgekeurd om te bouwen;
ze worden in delen opgeleverd. Werk aan dit plan gebeurt op de branch `seo-test-feature`.

**Zo gebruik je dit document:** noem een nummer (bijv. "bouw A1") en werk na afloop de status en de notities
in de tabel bij. Statussen: ⬜ open · 🟡 bezig · ✅ klaar · ⏸️ geparkeerd.

Opgesteld op 14 oktober 2026, na een scan van de code en van de live site.

---

## Uitgangssituatie (scan 14-10-2026)

**Al goed geregeld**
- Elke pagina krijgt server-side een eigen `<title>`, description, canonical-URL en og-tags (`server/seo.ts`).
- Onbekende pagina's geven een echte 404-status; query-strings krijgen een schone canonical.
- `sitemap.xml` en `robots.txt` bestaan (`server/app.ts`).
- Bedrijfsgegevens zijn ingevuld in het beheer: Usselerhalte 152, 7547 SH Enschede; ma–vr 08:30–18:00,
  za op afspraak, zo gesloten; KvK 93429177.
- Structured data bestaat voor bedrijf (homepage), diensten, producten en blog.

**Gevonden problemen**
1. **Inhoud niet zichtbaar zonder JavaScript.** De HTML van de server bevat ±83 tekens tekst; alle inhoud
   en de structured data (`useStructuredData`) worden pas in de browser opgebouwd. Google leest dat met
   vertraging; Bing, AI-zoekmachines (ChatGPT, Perplexity) en linkvoorbeelden zien een vrijwel lege pagina.
2. **`detail2go.nl` zonder www werkt niet goed**: via http een Vimexx-pagina, via https een fout
   (doorverwijzing in DirectAdmin staat nog open).
3. **Oude Wix-adressen geven 404**: opgebouwde posities van de oude site gaan verloren.
4. **Bedrijfs-structured data is mager**: geen openingstijden, coördinaten, socials, logo of werkgebied;
   en alleen client-side.
5. **Sitemap** zonder `lastmod` en zonder afbeeldingen.
6. **0 blogberichten**, geen pagina's per plaats, geen reviews op de site.

---

## A. Fundament (eenmalig, grootste impact)

| # | Feature | Wat het doet | Werk | Status | Notities |
|---|---|---|---|---|---|
| A1 | **Prerendering** | De server stuurt de volledige pagina-inhoud + structured data als echte HTML mee, zodat alle zoekmachines en AI-crawlers de teksten direct lezen. | Groot | ✅ | Klaar (14-10-2026). `src/entry-server.tsx` + `server/ssr.ts`; React `prerender`, data (blog, team) vooraf geladen en meegegeven. Beheer/checkout/bestelpagina's alleen in de browser. Bij een fout valt de pagina terug op de oude werking. Homepage: 83 → ±5.600 tekens tekst in de HTML. |
| A2 | **Structured data compleet, server-side** | LocalBusiness/AutomotiveBusiness volledig (openingstijden, geo, werkgebied/plaatsen, socials, logo), plus Service, Product, BreadcrumbList en FAQPage; met tests die de JSON-LD valideren. | Middel | ✅ | Klaar (14-10-2026). `shared/schema.ts`. Openingstijden worden uit het beheer gelezen. Geen geo-coördinaten (niet verzonnen); wel een Google Maps-link. Werkgebied: stad + Twente. |
| A3 | **Doorverwijzingen + 404-monitor in het beheer** | Toont welke dode URL's bezoekers en Google opvragen (o.a. oude Wix-adressen); 301-doorverwijzing met één klik. Doorlopend actief. | Middel | ✅ | Klaar (14-10-2026). Beheer → Doorverwijzingen. Vooraf ingesteld: /algemene-voorwaarden, /about-us, /auto-wassen-enschede, /level-1-handwas-exterieur (oude Wix-pagina's die Google nog kent). |
| A4 | **Domein rechttrekken** | `detail2go.nl` → 301 naar `https://www.detail2go.nl` (SSL + Site Redirection in DirectAdmin bij Vimexx). | Klein | 🟡 | Code klaar: andere domeinen die bij de server uitkomen (zoals het Railway-adres) sturen nu door naar www. **Nog handmatig:** het domein zonder www staat bij Vimexx; zie "Handmatige stap A4" hieronder. |
| A5 | **Snelheid** | Hero-foto zelf hosten (nu Unsplash), WebP/AVIF, kleinere JS-bundel, LCP-afbeelding preloaden. | Middel | ✅ | Klaar (14-10-2026), aangepast: gzip/brotli-compressie (hoofdbundel 476 → 147 kB, pagina's ±4× kleiner). Hero heeft al `fetchpriority=high` en staat door A1 direct in de HTML. **Bewust niet:** foto's vervangen of omzetten — alle afbeeldingen blijven zoals ingesteld in het beheer. Later mogelijk: WebP bij nieuwe uploads, bundel opsplitsen. |
| A6 | **Slimme sitemap** | `lastmod` per pagina, afbeeldingen in de sitemap, IndexNow-ping (Bing e.a.) bij elke inhoudswijziging. | Klein | ✅ | Klaar (14-10-2026). `server/sitemap.ts`. Datums komen uit het beheer (geen verzonnen datums). IndexNow alleen op de live (https) site; sleutel op `/<sleutel>.txt`. |

### Handmatige stap A4 (Vimexx / DirectAdmin)

`detail2go.nl` (zonder www) wijst via DNS naar de Vimexx-hosting en bereikt de webshop dus niet. Zo stuur je
het door:

1. Vimexx → Webhosting Basic → **Direct inloggen** (DirectAdmin).
2. **SSL-certificaten** → gratis Let's Encrypt-certificaat aanvragen voor `detail2go.nl`.
3. **Site Redirection** → `/` doorsturen naar `https://www.detail2go.nl/`, type **301**.
   Of via **Bestandsbeheer** → `public_html/.htaccess` met:
   ```
   RewriteEngine On
   RewriteRule ^(.*)$ https://www.detail2go.nl/$1 [R=301,L]
   ```
4. Controleer: `http://detail2go.nl/about-us` en `https://detail2go.nl` moeten allebei op www uitkomen.

## B. Lokale SEO

| # | Feature | Wat het doet | Werk | Status | Notities |
|---|---|---|---|---|---|
| B1 | **Review-motor** | Enkele dagen na een betaalde order of afgeronde afspraak automatisch een nette mail met directe link naar de Google-reviewpagina. | Middel | ⬜ | Alleen echte reviews; geen review-markup met eigen sterren (Google toont die niet voor LocalBusiness). |
| B2 | **Projectpagina's ("Recent opgeleverd")** | Elk opgeleverd project een eigen pagina (auto, behandeling, plaats, foto's), bijv. "PPF full front op een Porsche 911 in Hengelo". Automatisch in de sitemap. | Middel | ⬜ | Bouwt voort op de projecten die nu al op de homepage staan. |
| B3 | **Plaatspagina's** | Enschede, Hengelo, Oldenzaal, Almelo, Borne, Haaksbergen, Losser e.a., gevuld met **echte projecten** uit die plaats (uit B2). | Middel | ⬜ | Geen dunne kopie-pagina's: Google straft "doorway pages" af. Na B2 bouwen. |
| B4 | **Google Business Profile-koppeling** | Nieuwe projecten/blogs automatisch als GBP-bericht; openingstijden gelijk houden met het beheer. | Groot | ⬜ | Vereist API-toegang/goedkeuring van Google. |
| B5 | **NAP-checklist** | Lijst met belangrijke vermeldingen (Google, Bing Places, Apple Business Connect, Telefoongids, Cylex, …) met exacte naam/adres/telefoon om te kopiëren. | Klein | ⬜ | Vermeldingen zelf handmatig bijwerken. |

## C. Actieve SEO (verbetert zichzelf over tijd)

| # | Feature | Wat het doet | Werk | Status | Notities |
|---|---|---|---|---|---|
| C1 | **Google Search Console in het beheer** | Per pagina zoektermen, posities, klikken, CTR en trend. Basis voor C2/C3. | Middel | ⬜ | Vereist Search Console-verificatie van www.detail2go.nl. |
| C2 | **SEO-kansen-motor** | Wekelijks automatisch: pagina's met veel vertoningen maar weinig klikken, en zoektermen op positie 5–20. Claude stelt betere titel/description/alinea voor; jij keurt goed met één klik; daarna wordt gemeten of het hielp. | Groot | ⬜ | Na C1 en een paar weken data. |
| C3 | **Contentplanner met Claude** | Blogonderwerpen op basis van echte zoekvragen en seizoen (wintertips, voorjaarspoets, PPF vóór de zomer); Claude schrijft een concept, jij past aan en publiceert/plant in. | Middel | ⬜ | Altijd menselijke controle vóór publicatie. |
| C4 | **Automatische interne links** | Dienstnamen in blogs/projecten linken automatisch naar de dienstpagina; verwante berichten en diensten onder elke pagina. | Klein | ⬜ | |
| C5 | **Technische gezondheidscheck** | Wekelijkse scan van de eigen site: dode links, ontbrekende alt-teksten, dubbele/te lange titels, trage pagina's; rapport in het beheer (optioneel per mail). | Middel | ⬜ | |
| C6 | **Snelheidsmeting bij echte bezoekers** | Core Web Vitals (LCP, CLS, INP) per pagina via de cookieloze statistieken, met waarschuwing bij verslechtering. | Klein | ⬜ | |
| C7 | **Verouderde content signaleren** | Melding in het beheer bij pagina's die lang niet zijn bijgewerkt of klikken verliezen. | Klein | ⬜ | Sterker met C1-data. |
| C8 | **Alt-teksten automatisch** | Bij elke foto-upload schrijft Claude een beschrijvende alt-tekst (aanpasbaar). | Klein | ⬜ | Gebruikt de bestaande Anthropic-koppeling. |
| C9 | **Vragenbank → FAQ** | Echte klantvragen (afspraakformulier, contact) verzamelen in het beheer en met één klik omzetten naar FAQ-items op de juiste pagina. | Middel | ⬜ | |

## D. Extra bereik

| # | Feature | Wat het doet | Werk | Status | Notities |
|---|---|---|---|---|---|
| D1 | **Vindbaarheid in AI-zoekmachines** | AI-crawlers toestaan, `llms.txt`, heldere feitenpagina's zodat ChatGPT/AI Overviews Detail2Go noemen. | Klein | ⬜ | Werkt pas goed samen met A1. |
| D2 | **Engelse pagina's die Google kan vinden** | `/en/…` met hreflang, gevuld uit het bestaande vertaalgeheugen; bereik onder expats/studenten (UT, Saxion). | Middel | ⬜ | Na A1. |

---

## Volgorde

1. **Fundament:** A1, A2, A3, A4 (daarna A5, A6). Zonder dit fundament werkt de rest maar half.
2. **Doorlopende motoren:** B1 (reviews), B2 (projectpagina's), C1 (Search Console).
3. **Daarop voortbouwend:** B3 (na B2), C2 en C7 (na een paar weken C1-data), C3, C4, C5, C6, C8, C9.
4. **Uitbreiding:** B4, B5, D1, D2.

## Uitgangspunten

- Geen garantie op posities; Google beloont echte, unieke inhoud en echte reviews.
- Features laten het dagelijkse werk (projecten, klanten, vragen) vanzelf content en signalen opleveren — geen
  trucjes die Google kan afstraffen (geen nep-reviews, geen massaal gegenereerde dunne pagina's).
- Door Claude geschreven teksten worden altijd eerst door een mens gecontroleerd voordat ze live gaan.
- Elke feature komt met tests en wordt eerst op `seo-test-feature` gebouwd; pas na akkoord naar `working-branch`
  en daarna `main` (live).
