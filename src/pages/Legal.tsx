import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { formatPrice, SHIPPING } from '../../shared/pricing';
import { SITE } from '../../shared/site';
import { Eyebrow } from '../components/ui';
import { usePageMeta } from '../lib/meta';

// NOTE: these texts are a careful starting point, not legal advice. Have them
// checked (e.g. against the Thuiswinkel or NL Digital model texts) before launch.

type PageId = 'voorwaarden' | 'privacy' | 'retourneren' | 'verzending';

const UPDATED = '7 oktober 2026';

const company = `${SITE.legalName}, ${SITE.address.street}, ${SITE.address.postalCode} ${SITE.address.city}, KvK ${SITE.kvk}, btw-nummer ${SITE.vatNumber}`;

const PAGES: Record<PageId, { title: string; description: string; body: () => ReactNode }> = {
  verzending: {
    title: 'Verzending & betalen',
    description: 'Verzendkosten, levertijden en betaalmethoden van de webshop.',
    body: () => (
      <>
        <H2>Levertijd</H2>
        <P>
          Bestellingen die op een werkdag zijn betaald, geven we binnen {SITE.dispatchDays} af bij {SITE.carrier}. Binnen
          Nederland wordt een pakket meestal de werkdag daarna bezorgd, naar België binnen 1–3 werkdagen. Zodra je pakket
          onderweg is, ontvang je een e-mail met een track-and-trace code.
        </P>
        <H2>Verzendkosten</H2>
        <table className="tabular my-6 w-full border-collapse text-left text-[15px]">
          <thead>
            <tr className="border-b border-ink/20">
              <th className="py-2 font-medium">Land</th>
              <th className="py-2 font-medium">Verzendkosten</th>
              <th className="py-2 font-medium">Gratis vanaf</th>
            </tr>
          </thead>
          <tbody>
            {Object.values(SHIPPING).map((s) => (
              <tr key={s.label} className="border-b border-ink/10">
                <td className="py-2">{s.label}</td>
                <td className="py-2">{formatPrice(s.cost)}</td>
                <td className="py-2">{formatPrice(s.freeFrom)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <P>We verzenden op dit moment alleen naar Nederland en België. Alle prijzen zijn inclusief 21% btw.</P>
        <H2>Betalen</H2>
        <P>
          Je betaalt vooraf en veilig via onze betaalpartner Mollie. Afhankelijk van je land kun je kiezen uit onder meer
          iDEAL, Bancontact en creditcard. We ontvangen geen bank- of kaartgegevens; die verwerkt Mollie.
        </P>
        <H2>Factuur</H2>
        <P>
          Je ontvangt na betaling een orderbevestiging per e-mail. Heb je een factuur op bedrijfsnaam nodig? Mail ons je
          bestelnummer en bedrijfsgegevens via <Mail />.
        </P>
      </>
    ),
  },

  retourneren: {
    title: 'Retourneren & herroepingsrecht',
    description: `Je hebt ${SITE.returnDays} dagen bedenktijd. Zo meld je een retour aan.`,
    body: () => (
      <>
        <P>
          Als consument heb je het recht om je aankoop binnen {SITE.returnDays} dagen zonder opgave van redenen te
          ontbinden (herroepingsrecht). Deze bedenktijd gaat in op de dag nadat je het product hebt ontvangen.
        </P>
        <H2>Zo werkt retourneren</H2>
        <ol className="my-6 list-decimal space-y-3 pl-5 leading-relaxed text-stone-dark">
          <li>
            Meld je retour binnen {SITE.returnDays} dagen na ontvangst via <Mail /> met je bestelnummer, of gebruik het
            modelformulier hieronder.
          </li>
          <li>
            Stuur het product binnen {SITE.returnDays} dagen na je melding terug naar {SITE.address.street},{' '}
            {SITE.address.postalCode} {SITE.address.city}. De kosten voor het terugsturen zijn voor jou.
          </li>
          <li>
            We betalen het aankoopbedrag, inclusief de oorspronkelijke verzendkosten, binnen 14 dagen na je melding terug.
            We mogen wachten met terugbetalen tot we het product hebben ontvangen.
          </li>
        </ol>
        <H2>Gebruik tijdens de bedenktijd</H2>
        <P>
          Je mag het product tijdens de bedenktijd uitpakken en bekijken zoals je dat in een winkel zou doen. Is het product
          meer gebruikt dan nodig is om de aard en werking vast te stellen — bijvoorbeeld een flacon die deels is
          opgebruikt — dan mogen we de waardevermindering in rekening brengen.
        </P>
        <H2>Modelformulier voor herroeping</H2>
        <div className="my-6 border border-ink/15 bg-white p-6 text-[15px] leading-relaxed">
          <p>
            Aan: {company}, {SITE.email}
          </p>
          <p className="mt-4">
            Ik deel u hierbij mede dat ik onze overeenkomst betreffende de verkoop van de volgende producten herroep:
          </p>
          <ul className="mt-4 space-y-2 text-stone-dark">
            <li>Bestelnummer: …………………………</li>
            <li>Besteld op / ontvangen op: …………………………</li>
            <li>Product(en): …………………………</li>
            <li>Naam: …………………………</li>
            <li>Adres: …………………………</li>
            <li>IBAN: …………………………</li>
            <li>Datum en handtekening (alleen bij papieren formulier): …………………………</li>
          </ul>
        </div>
        <H2>Defect of verkeerd geleverd?</H2>
        <P>
          Klopt er iets niet met je bestelling, of is een product beschadigd aangekomen? Mail ons binnen een redelijke termijn
          een foto en je bestelnummer via <Mail />. We lossen het kosteloos voor je op.
        </P>
      </>
    ),
  },

  voorwaarden: {
    title: 'Algemene voorwaarden',
    description: 'Algemene voorwaarden voor de webshop en voor behandelingen in de studio.',
    body: () => (
      <>
        <H2>1. Wie wij zijn</H2>
        <P>
          Deze voorwaarden zijn van {company}. Je bereikt ons via {SITE.phone} of <Mail />.
        </P>
        <H2>2. Toepasselijkheid</H2>
        <P>
          Deze voorwaarden gelden voor ieder aanbod van ons en voor iedere overeenkomst die je met ons sluit, zowel voor
          bestellingen in de webshop (deel A) als voor behandelingen in de studio (deel B). Voordat je een bestelling
          plaatst, stellen we deze voorwaarden beschikbaar; je kunt ze opslaan of printen.
        </P>

        <H2>Deel A — Webshop</H2>
        <H3>A1. Aanbod en prijzen</H3>
        <P>
          Ons aanbod bevat een zo volledig en nauwkeurig mogelijke omschrijving van de producten. Kennelijke vergissingen of
          fouten in het aanbod binden ons niet. Alle prijzen zijn in euro’s en inclusief 21% btw. Verzendkosten worden voor
          het afronden van de bestelling duidelijk vermeld.
        </P>
        <H3>A2. De overeenkomst</H3>
        <P>
          De overeenkomst komt tot stand op het moment dat je de bestelling plaatst met de knop ‘Bestellen en betalen’ en
          de betaling is gelukt. Je ontvangt daarvan direct een bevestiging per e-mail.
        </P>
        <H3>A3. Levering</H3>
        <P>
          We leveren in Nederland en België op het adres dat je bij de bestelling opgeeft. We streven ernaar binnen{' '}
          {SITE.dispatchDays} te verzenden, en leveren uiterlijk binnen 30 dagen. Lukt dat niet, dan laten we je dat weten
          en mag je de overeenkomst kosteloos ontbinden. Het risico van beschadiging of vermissing ligt bij ons tot het
          moment van bezorging.
        </P>
        <H3>A4. Herroepingsrecht</H3>
        <P>
          Je hebt {SITE.returnDays} dagen bedenktijd na ontvangst. Hoe dat werkt, inclusief het modelformulier, lees je op
          de pagina <Link to="/retourneren" className="underline underline-offset-4">Retourneren & herroepingsrecht</Link>.
        </P>
        <H3>A5. Conformiteit en garantie</H3>
        <P>
          We staan ervoor in dat de producten voldoen aan de overeenkomst en de redelijke verwachtingen. Je wettelijke
          rechten blijven altijd van kracht. Gebruik de producten volgens de gebruiksaanwijzing en test reinigingsmiddelen
          eerst op een onopvallende plek.
        </P>

        <H2>Deel B — Behandelingen in de studio</H2>
        <H3>B1. Aanvraag en afspraak</H3>
        <P>
          Een aanvraag via de website is vrijblijvend. Een afspraak staat pas vast nadat wij datum en prijs hebben bevestigd.
          Vanaf-prijzen zijn indicatief; de definitieve prijs hangt af van formaat en staat van de auto en spreken we vooraf
          met je af.
        </P>
        <H3>B2. Verzetten of annuleren</H3>
        <P>
          Kun je niet op de afgesproken datum? Laat het ons uiterlijk 48 uur vooraf weten, dan plannen we kosteloos een
          nieuwe datum.
        </P>
        <H3>B3. Uitvoering</H3>
        <P>
          We voeren behandelingen zorgvuldig en vakkundig uit. Bestaande schade, zoals steenslag, diepe krassen of eerder
          overgespoten delen, leggen we bij de inspectie samen met je vast. Bij lakcorrectie verwijderen we zo min mogelijk
          blanke lak; krassen die door de blanke lak heen gaan, zijn niet altijd volledig te verwijderen.
        </P>
        <H3>B4. Betaling</H3>
        <P>Behandelingen betaal je bij het ophalen van de auto, tenzij we schriftelijk iets anders afspreken.</P>

        <H2>3. Klachten</H2>
        <P>
          Heb je een klacht? Meld die zo snel mogelijk, volledig en duidelijk omschreven via <Mail />. We reageren binnen 14
          dagen. Komen we er samen niet uit, dan kun je het geschil voorleggen aan de bevoegde rechter.
        </P>
        <H2>4. Toepasselijk recht</H2>
        <P>Op deze voorwaarden en alle overeenkomsten met ons is Nederlands recht van toepassing.</P>
      </>
    ),
  },

  privacy: {
    title: 'Privacybeleid',
    description: 'Welke persoonsgegevens we verwerken, waarom, en wat je rechten zijn.',
    body: () => (
      <>
        <P>
          {company} is verantwoordelijk voor de verwerking van je persoonsgegevens zoals beschreven in dit privacybeleid.
          Vragen? Mail naar <Mail />.
        </P>
        <H2>Welke gegevens en waarom</H2>
        <ul className="my-6 space-y-4 leading-relaxed text-stone-dark">
          <li>
            <strong className="text-ink">Bestellingen</strong> — naam, adres, e-mailadres, telefoonnummer (optioneel) en je
            bestelling. Nodig om je bestelling te verwerken, te verzenden en je op de hoogte te houden (uitvoering van de
            overeenkomst). We bewaren deze gegevens 7 jaar vanwege de fiscale bewaarplicht.
          </li>
          <li>
            <strong className="text-ink">Afspraakaanvragen</strong> — naam, e-mailadres, telefoonnummer, postcode, gegevens
            van je auto en je toelichting. Nodig om contact met je op te nemen en de afspraak in te plannen. We bewaren een
            aanvraag zonder afspraak maximaal 12 maanden.
          </li>
          <li>
            <strong className="text-ink">Betalingen</strong> — verwerkt door Mollie B.V. We ontvangen alleen de status en
            de gekozen betaalmethode, geen bank- of kaartgegevens.
          </li>
        </ul>
        <H2>Met wie we gegevens delen</H2>
        <P>
          Alleen met partijen die nodig zijn voor de uitvoering: Mollie (betalingen), {SITE.carrier} (bezorging: naam en
          adres) en onze hosting- en e-mailprovider. Met hen hebben we waar nodig een verwerkersovereenkomst. We verkopen je
          gegevens nooit.
        </P>
        <H2>Cookies</H2>
        <P>
          Deze website gebruikt geen tracking- of advertentiecookies. We slaan alleen de inhoud van je winkelwagen lokaal in
          je browser op, zodat die bewaard blijft als je de pagina opnieuw laadt. Daarvoor is geen toestemming nodig.
        </P>
        <H2>Je rechten</H2>
        <P>
          Je hebt het recht om je gegevens in te zien, te laten corrigeren of verwijderen, en om bezwaar te maken tegen de
          verwerking. Stuur je verzoek naar <Mail />; we reageren binnen een maand. Ben je het niet eens met hoe we met je
          gegevens omgaan, dan kun je een klacht indienen bij de Autoriteit Persoonsgegevens.
        </P>
        <H2>Beveiliging</H2>
        <P>
          We nemen passende maatregelen om je gegevens te beveiligen, zoals een versleutelde verbinding (https) en beperkte
          toegang tot de beheeromgeving.
        </P>
      </>
    ),
  },
};

function H2({ children }: { children: ReactNode }) {
  return <h2 className="font-display mt-12 text-2xl first:mt-0">{children}</h2>;
}

function H3({ children }: { children: ReactNode }) {
  return <h3 className="mt-8 font-semibold">{children}</h3>;
}

function P({ children }: { children: ReactNode }) {
  return <p className="mt-4 leading-relaxed text-stone-dark">{children}</p>;
}

function Mail() {
  return (
    <a href={`mailto:${SITE.email}`} className="text-ink underline underline-offset-4">
      {SITE.email}
    </a>
  );
}

export default function Legal({ page }: { page: PageId }) {
  const content = PAGES[page];
  usePageMeta(content.title, content.description);
  return (
    <div className="bg-paper pt-16 text-ink md:pt-[72px]">
      <article className="container-page max-w-3xl py-14 md:py-20">
        <Eyebrow className="text-stone-dark">Klantenservice</Eyebrow>
        <h1 className="font-display mt-5 text-[clamp(2.25rem,5vw,3.5rem)] leading-[1.02]">{content.title}</h1>
        <p className="mt-4 text-sm text-stone-dark">Laatst bijgewerkt: {UPDATED}</p>
        <div className="mt-10 text-[16px]">{content.body()}</div>
      </article>
    </div>
  );
}
