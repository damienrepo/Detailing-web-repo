// Services shown on /diensten, the homepage and in the booking form. The id doubles as the URL slug.
// TODO: check prices, durations, on-location availability and FAQ answers against the actual offer.
import { formatPrice, VAT_RATE } from './pricing';

export type ServiceCategory = 'wassen' | 'interieur' | 'lak' | 'herstel';

export const CATEGORIES: { id: ServiceCategory; name: string; title: string; intro: string }[] = [
  { id: 'wassen', name: 'Wassen & onderhoud', title: 'Schoon, zonder krassen.', intro: 'Een veilige, grondige wasbeurt — eenmalig, bij je thuis of als vast abonnement.' },
  { id: 'interieur', name: 'Interieur & techniek', title: 'Fris tot in elke hoek.', intro: 'Van stoelrails tot motorruimte: schoon tot in de hoeken die je normaal niet ziet.' },
  { id: 'lak', name: 'Lak & bescherming', title: 'Glans die blijft.', intro: 'Glans terugbrengen en de lak daarna jarenlang beschermen.' },
  { id: 'herstel', name: 'Herstel', title: 'Alsof het nooit gebeurd is.', intro: 'Deuken, krassen en lakschade herstellen, zo dicht mogelijk bij de fabrieksstaat.' },
];

export type ServiceOption = {
  name: string;
  /** Short highlight, e.g. "± 60% correctie" or "18 maanden". */
  label?: string;
  text: string;
  items?: string[];
  /** Photo name in public/services, see `image` on Service. */
  image?: string;
  /** For PPF packages: which part of the car the film covers (drawn as an illustration). */
  coverage?: 'partial' | 'front' | 'full';
  /** Marks the option customers choose most. */
  popular?: boolean;
};

export type OptionGroup = {
  title: string;
  intro?: string;
  /** Cards with a photo and checklist, compact text-only tiles, or PPF coverage drawings. */
  style: 'cards' | 'tiles' | 'coverage';
  options: ServiceOption[];
};

/** A comparison table, e.g. PPF vs. coating vs. wax. */
export type Comparison = {
  title: string;
  intro?: string;
  columns: string[];
  /** Index of the column to highlight (this service). */
  highlight?: number;
  rows: { label: string; values: string[] }[];
  note?: string;
};

export type Service = {
  id: string;
  /** Hidden in the admin: not shown on the site or in the booking form. */
  hidden?: boolean;
  name: string;
  category: ServiceCategory;
  /** One line for cards and the hero. */
  tagline: string;
  /** Short paragraph for the booking form and search results. */
  summary: string;
  /** Paragraphs for the "what is it" section on the service page. */
  intro: string[];
  /** Starting price in euro cents incl. btw; null means price on request. */
  fromPrice: number | null;
  duration: string;
  /** Whether we can do this at the customer's address (water and power needed). */
  onLocation: boolean;
  /** Photo name in public/services: `<name>.jpg` (1600px) and `<name>-sm.jpg` (800px). */
  image: string;
  imageAlt: string;
  /** Second photo next to the intro. */
  detailImage?: { src: string; alt: string };
  includes: string[];
  benefits: { title: string; text: string }[];
  options?: OptionGroup[];
  comparison?: Comparison;
  steps: { title: string; text: string }[];
  faq: { q: string; a: string }[];
  related: string[];
};

/** Prices on the old site were quoted excl. btw; consumers must see prices incl. btw. */
const inclVat = (euroExVat: number) => Math.round(euroExVat * 100 * (1 + VAT_RATE));

const PAINT_CORRECTION: OptionGroup = {
  title: 'Kies het niveau van lakcorrectie',
  intro: 'Hoeveel stappen nodig zijn hangt af van de staat van de lak. We meten de laklaagdikte en adviseren ter plekke wat haalbaar is.',
  style: 'cards',
  options: [
    {
      name: '1 stap',
      label: '± 60% correctie',
      text: 'Eén polijstronde met een fijne finishing polish en een zachte pad. Haalt tot ongeveer 60% van de zichtbare swirls weg en brengt de glans terug.',
      items: ['Voor auto’s in redelijke staat', 'Maximale glans, minimale lakafname', 'Ideale basis onder een coating'],
      image: 'polijsten-stap-1',
    },
    {
      name: '2 stappen',
      label: '± 75–85% correctie',
      text: 'Eerst een snijdende compound voor krassen en swirls, daarna een finishing stap voor diepte en helderheid. De beste balans voor de meeste auto’s.',
      items: ['Compound + finishing', 'Verwijdert het merendeel van de krassen', 'Onze meest gekozen behandeling'],
      image: 'polijsten-stap-2',
    },
    {
      name: '3 stappen',
      label: '± 95% correctie',
      text: 'Intensieve correctie voor lak met zware schade: zwaar snijden, medium polish, fijne finish en een ultrafijne afwerking voor een spiegelend resultaat.',
      items: ['Voor zwaar beschadigde of verwaarloosde lak', 'Show-car resultaat', 'Advies op locatie vooraf'],
      image: 'polijsten',
    },
  ],
};

const COATING_PACKAGES: OptionGroup = {
  title: 'Pakketten',
  intro: 'Beide pakketten beginnen met dezelfde grondige voorbereiding. Het verschil zit in de levensduur van de coating.',
  style: 'cards',
  options: [
    {
      name: 'Level 1 · Excellent',
      label: 'Tot 18 maanden',
      text: 'Volledige voorbereiding en een coating die anderhalf jaar beschermt. Een sterke keuze voor de dagelijkse rijder.',
      items: ['Exterieur reiniging', 'Exterieur decontaminatie', 'Lakcorrectie naar keuze', 'Glascoating 18 maanden'],
      image: 'coatings-level-1',
    },
    {
      name: 'Level 2 · Ultimate',
      label: 'Tot 36 maanden',
      text: 'Dezelfde voorbereiding met onze sterkste coating. Drie jaar bescherming, extra diepe glans en het hoogste water- en vuilafstotend vermogen.',
      items: ['Exterieur reiniging', 'Exterieur decontaminatie', 'Lakcorrectie naar keuze', 'Glascoating 36 maanden'],
      image: 'coatings-level-2',
    },
  ],
};

const COATING_EXTRAS: OptionGroup = {
  title: 'Extra coatings',
  intro: 'Maak de bescherming compleet. Te combineren met elk pakket.',
  style: 'tiles',
  options: [
    { name: 'Velgen', text: 'Remstof brandt niet meer vast. Velgen zijn zelfreinigend en water- en vuilafstotend.' },
    { name: 'Ruiten', text: 'Water parelt direct weg: beter zicht bij regen, minder ruitenwissen en geen klapperende wissers.' },
    { name: 'Leer', text: 'Behoudt de fabriekslook, voedt het leer, is water- en vuilafstotend en voorkomt kleurafgifte van kleding.' },
    { name: 'Kunststof', text: 'UV-bescherming die verkleuring en oxidatie voorkomt, zodat zwart weer zwart blijft.' },
    { name: 'Softtop', text: 'Voor cabriodaken: water- en vuilafstotend, gaat verkleuring tegen en voorkomt algengroei.' },
  ],
};

const LOCATION_FAQ = {
  q: 'Wat heb ik nodig als jullie bij mij komen?',
  a: 'Een stroom- en wateraansluiting en genoeg ruimte rondom de auto om goed te kunnen werken. Wij nemen alle apparatuur en producten mee.',
};

export const SERVICES: Service[] = [
  {
    id: 'luxe-handwas',
    name: 'Luxe handwas',
    category: 'wassen',
    tagline: 'De veiligste manier om je auto te wassen, met de hand en met aandacht.',
    summary: 'Grondige handwas van lak, velgen, wielkasten en instaplijsten, inclusief ruiten en dressing van banden en kunststof.',
    intro: [
      'Een wasstraat is snel, maar borstels en vuil water laten fijne krassen achter die je in de zon terugziet als swirls. Wij wassen met de hand, met de twee-emmermethode en schone microvezel, zodat de lak zo min mogelijk wordt aangeraakt door vuil.',
      'Na het wassen krijgen banden en kunststof een verzorgende dressing en maken we de ruiten streeploos schoon. Het resultaat: een auto die er weer als nieuw uitziet, zonder risico voor de lak.',
    ],
    fromPrice: inclVat(60),
    duration: '1,5 – 2 uur',
    onLocation: true,
    image: 'luxe-handwas',
    imageAlt: 'Auto wordt voorgespoeld met een hogedrukspuit bij zonsondergang',
    detailImage: { src: 'luxe-handwas-rsq8', alt: 'Glanzende Audi RS Q8 na een luxe handwas' },
    includes: [
      'Voorspoelen met hogedruk en voorwas',
      'Handwas met twee-emmermethode',
      'Velgen en wielkasten reinigen',
      'Instaplijsten en deurstijlen',
      'Kunststof en banden dressen',
      'Ruiten binnen- en buitenzijde',
    ],
    benefits: [
      { title: 'Lakvriendelijk', text: 'Geen borstels of hergebruikt water: de kans op krassen is minimaal.' },
      { title: 'Tot in de details', text: 'Ook de plekken die een wasstraat overslaat, zoals deurstijlen en wielkasten.' },
      { title: 'Bij jou op de oprit', text: 'We komen naar je toe in Enschede en omstreken, of je brengt de auto langs.' },
    ],
    steps: [
      { title: 'Voorspoelen', text: 'Losliggend vuil en zand spoelen we eerst weg met hogedruk en een voorwas, zodat het niet over de lak wordt gewreven.' },
      { title: 'Handwas', text: 'Paneel voor paneel wassen met een pH-neutrale shampoo en de twee-emmermethode.' },
      { title: 'Velgen & wielkasten', text: 'Remstof en wegvuil verwijderen met aparte borstels en producten.' },
      { title: 'Afwerking', text: 'Drogen met zachte droogdoeken, ruiten streeploos en dressing op banden en kunststof.' },
    ],
    faq: [
      { q: 'Hoe vaak moet ik mijn auto laten wassen?', a: 'Gemiddeld eens per twee tot vier weken. Met een handwas abonnement plannen we dat vast voor je in, tegen een vaste prijs per beurt.' },
      { q: 'Is een handwas ook goed voor een auto met coating?', a: 'Juist. Een coating blijft het langst mooi met een veilige handwas en de juiste shampoo. Een wasstraat slijt de coating sneller.' },
      LOCATION_FAQ,
    ],
    related: ['handwas-abonnement', 'interieur-reiniging', 'coatings'],
  },
  {
    id: 'handwas-abonnement',
    name: 'Handwas abonnement',
    category: 'wassen',
    tagline: 'Je auto het hele jaar door schoon, zonder dat je er nog naar om hoeft te kijken.',
    summary: 'Vaste luxe handwas op een frequentie die bij jou past, bij je thuis of op het werk, tegen een vaste prijs per beurt.',
    intro: [
      'Met een abonnement hoef je nooit meer zelf een afspraak te plannen. We spreken een vaste frequentie af — bijvoorbeeld elke twee of vier weken — en komen op het afgesproken moment bij je langs voor een luxe handwas.',
      'Regelmatig wassen voorkomt dat vuil, vogelpoep en remstof zich vastzetten in de lak. Dat houdt je auto niet alleen mooi, het beschermt ook de waarde. Heb je een coating? Dan zorgt een vaste wasbeurt ervoor dat die maximaal blijft presteren.',
    ],
    fromPrice: null,
    duration: '1,5 – 2 uur per beurt',
    onLocation: true,
    image: 'handwas-abonnement',
    imageAlt: 'Zwarte Audi RS Q8 glanzend schoon op een oprit in het bos',
    detailImage: { src: 'luxe-handwas', alt: 'Voorspoelen van een auto met hogedruk' },
    includes: [
      'Luxe handwas op vaste momenten',
      'Velgen, wielkasten en instaplijsten',
      'Ruiten en dressing van banden',
      'Vaste prijs per beurt',
      'Voorrang bij het inplannen van extra behandelingen',
      'Onderhoud dat past bij een coating',
    ],
    benefits: [
      { title: 'Altijd schoon', text: 'Geen vuil dat zich weken vastzet: de lak blijft in topconditie.' },
      { title: 'Geen omkijken', text: 'Vaste dag en tijd. Wij komen langs, jij hoeft niets te regelen.' },
      { title: 'Vaste prijs', text: 'Je weet vooraf precies wat je per beurt betaalt, zonder verrassingen.' },
      { title: 'Voorrang', text: 'Abonnees krijgen voorrang bij het plannen van polijsten, coatings en interieurreiniging.' },
    ],
    options: [
      {
        title: 'Kies je frequentie',
        intro: 'De prijs per beurt hangt af van de frequentie en het formaat van de auto. Vraag een voorstel op maat aan.',
        style: 'tiles',
        options: [
          { name: 'Elke 2 weken', label: 'Altijd showroomklaar', text: 'Voor wie de auto dagelijks gebruikt en hem altijd strak wil hebben.' },
          { name: 'Elke 4 weken', label: 'Meest gekozen', text: 'De gulden middenweg: vuil krijgt geen kans om zich vast te zetten.' },
          { name: 'Elke 6 weken', label: 'Basisonderhoud', text: 'Voor een tweede auto of wie minder kilometers maakt.' },
        ],
      },
    ],
    steps: [
      { title: 'Kennismaking', text: 'We bekijken de auto, spreken de frequentie en locatie af en sturen je een voorstel.' },
      { title: 'Vaste planning', text: 'Je krijgt vaste momenten in de agenda. Een week niet uitgekomen? Dan schuiven we in overleg.' },
      { title: 'Wasbeurt', text: 'Iedere beurt een complete luxe handwas, met dezelfde aandacht als de eerste keer.' },
      { title: 'Advies', text: 'Zien we dat de lak of het interieur extra aandacht nodig heeft, dan laten we het je weten.' },
    ],
    faq: [
      { q: 'Kan ik ook kiezen voor een andere frequentie?', a: 'Ja. De frequenties hierboven zijn een richtlijn, we stemmen het abonnement af op hoe je de auto gebruikt.' },
      { q: 'Kan ik er een interieurbeurt aan toevoegen?', a: 'Zeker. Veel abonnees combineren de wasbeurt periodiek met een interieurreiniging. Geef het aan in je aanvraag.' },
      LOCATION_FAQ,
    ],
    related: ['luxe-handwas', 'handwas-op-locatie', 'coatings'],
  },
  {
    id: 'handwas-op-locatie',
    name: 'Reiniging op locatie',
    category: 'wassen',
    tagline: 'Binnen en buiten schoon, bij jou thuis of op het werk.',
    summary: 'Complete interieur- en exterieurreiniging op je eigen adres. Geen reistijd, met dezelfde producten en aandacht als in onze werkplaats.',
    intro: [
      'Geen tijd om je auto weg te brengen? Dan komen wij naar je toe. Thuis op de oprit of op de parkeerplaats van je werk: we komen volledig uitgerust en reinigen je auto van binnen en van buiten.',
      'Je krijgt precies dezelfde kwaliteit als in onze werkplaats. Ondertussen ga jij gewoon door met je dag — en wil je zien hoe we werken, dan kijk je gerust even mee.',
    ],
    fromPrice: null,
    duration: '3 – 5 uur',
    onLocation: true,
    image: 'handwas-op-locatie',
    imageAlt: 'Het Detail2Go-team bij een Porsche Boxster Spyder op locatie',
    detailImage: { src: 'handwas-op-locatie-velg', alt: 'Schone velg van een zwarte Porsche na reiniging op locatie' },
    includes: [
      'Luxe handwas van het exterieur',
      'Velgen, wielkasten en instaplijsten',
      'Stofzuigen incl. kofferbak en matten',
      'Dashboard, panelen en kunststof',
      'Ruiten binnen- en buitenzijde',
      'Premium producten, wij nemen alles mee',
    ],
    benefits: [
      { title: 'Geen reistijd', text: 'Je auto blijft waar hij staat. Wij komen naar Enschede en omstreken.' },
      { title: 'Flexibel', text: 'We plannen een moment dat jou uitkomt, ook op het werk.' },
      { title: 'Zelfde standaard', text: 'Dezelfde producten, apparatuur en aandacht als in onze werkplaats.' },
    ],
    steps: [
      { title: 'Aanvragen', text: 'Laat ons weten waar de auto staat en wanneer het je uitkomt.' },
      { title: 'Inplannen', text: 'We nemen contact op om een datum en tijd te bevestigen.' },
      { title: 'Aankomst', text: 'We komen op tijd en volledig uitgerust aan. Jij zorgt voor water en stroom.' },
      { title: 'Reiniging', text: 'Interieur en exterieur worden grondig gereinigd, tot in de details.' },
      { title: 'Inspectie', text: 'We lopen de auto samen met je na en geven tips om het resultaat lang mooi te houden.' },
    ],
    faq: [
      LOCATION_FAQ,
      { q: 'Moet ik thuis zijn?', a: 'Niet per se. Als de auto bereikbaar is en we water en stroom kunnen gebruiken, spreken we vooraf af hoe we de sleutel en de oplevering regelen.' },
      { q: 'Kunnen jullie ook polijsten of coaten op locatie?', a: 'Polijsten en coatings doen we het liefst in onze werkplaats, waar we licht, temperatuur en stof onder controle hebben. Vraag gerust wat in jouw situatie mogelijk is.' },
    ],
    related: ['luxe-handwas', 'interieur-reiniging', 'handwas-abonnement'],
  },
  {
    id: 'interieur-reiniging',
    name: 'Interieur reiniging',
    category: 'interieur',
    tagline: 'Een fris, hygiënisch interieur — van stoelen tot dashboard.',
    summary: 'Volledige dieptereiniging van het interieur: stoelen, leer, kunststof, schakelaars en luchtroosters, inclusief vlekken- en geurverwijdering.',
    intro: [
      'In het interieur breng je de meeste tijd door, maar het is ook de plek waar stof, bacteriën en luchtjes zich ophopen. Onze interieurbehandeling pakt alles aan: van de stoelrails en pedalen tot de luchtroosters en gordels.',
      'Bekleding en matten reinigen we met een extractor, leer met een milde leerreiniger en kunststof met producten die geen glimmend laagje achterlaten. Je stapt weer in een auto die er fris uitziet en fris ruikt.',
    ],
    fromPrice: inclVat(100),
    duration: '2 – 4 uur',
    onLocation: true,
    image: 'interieur-reiniging',
    imageAlt: 'Gereinigd dashboard en stuur van een Porsche',
    detailImage: { src: 'interieur-reiniging-dashboard', alt: 'Interieur van een Porsche Boxster Spyder na reiniging' },
    includes: [
      'Volledig stofzuigen incl. kofferbak',
      'Schakelaars, pedalen, stoelrails en luchtroosters',
      'Vlekken verwijderen uit bekleding en matten',
      'Lederen bekleding reinigen',
      'Geurverwijdering',
      'Ruiten binnenzijde',
    ],
    benefits: [
      { title: 'Hygiënisch', text: 'Stof, bacteriën en allergenen worden grondig verwijderd.' },
      { title: 'Fris', text: 'Nare geurtjes worden geneutraliseerd in plaats van overstemd.' },
      { title: 'Waardebehoud', text: 'Een verzorgd interieur maakt het verschil bij inruil of verkoop.' },
    ],
    options: [
      {
        title: 'Uitbreiden met',
        style: 'tiles',
        options: [
          { name: 'Leercoating', text: 'Behoudt de fabriekslook van leer, voedt het en voorkomt kleurafgifte van kleding.' },
          { name: 'Kunststofcoating', text: 'UV-bescherming voor dashboard en panelen, tegen verkleuren en uitdrogen.' },
          { name: 'Technische ruimte', text: 'Ook de motorruimte grondig gereinigd en geconserveerd.' },
        ],
      },
    ],
    steps: [
      { title: 'Leeghalen & stofzuigen', text: 'Matten eruit, alles grondig stofzuigen, tot onder de stoelen en in de kofferbak.' },
      { title: 'Details', text: 'Met zachte kwasten en borstels alle naden, knoppen, roosters en rails schoon.' },
      { title: 'Bekleding & leer', text: 'Vlekken behandelen, stof extraheren en leer reinigen en voeden.' },
      { title: 'Afwerking', text: 'Kunststof mat afwerken, ruiten streeploos en geurneutralisatie.' },
    ],
    faq: [
      { q: 'Gaan alle vlekken eruit?', a: 'De meeste wel. Oude of ingetrokken vlekken, zoals koffie of inkt, kunnen soms niet volledig verdwijnen. We laten vooraf weten wat je kunt verwachten.' },
      { q: 'Hoe lang moet het interieur drogen?', a: 'Na het extraheren is de bekleding meestal binnen een paar uur droog. Bij koud weer raden we aan de auto even te laten luchten.' },
      { q: 'Halen jullie ook hondenharen weg?', a: 'Ja. Geef het even aan in je aanvraag, dan plannen we er de juiste tijd voor in.' },
      LOCATION_FAQ,
    ],
    related: ['technische-ruimte', 'handwas-op-locatie', 'luxe-handwas'],
  },
  {
    id: 'technische-ruimte',
    name: 'Technische ruimte',
    category: 'interieur',
    tagline: 'Een schone, geconserveerde motorruimte — veilig gereinigd.',
    summary: 'Zorgvuldige reiniging van de motorruimte: vet en wegvuil verwijderen, kunststof en rubbers conserveren, elektronica beschermd.',
    intro: [
      'De motorruimte wordt vaak vergeten, terwijl vet, stof en wegzout daar ongestoord hun gang gaan. Een schone motorruimte ziet er niet alleen goed uit bij het openen van de motorkap, het maakt ook lekkages en slijtage eerder zichtbaar.',
      'Wij reinigen de technische ruimte met beleid: gevoelige elektronica wordt afgedekt, we werken met lage druk en specifieke reinigers, en drogen alles met perslucht. Tot slot conserveren we kunststof en rubbers zodat ze niet uitdrogen.',
    ],
    fromPrice: null,
    duration: '1 – 2 uur',
    onLocation: true,
    image: 'technische-ruimte',
    imageAlt: 'Motorruimte van een Mercedes wordt met een microvezeldoek gereinigd',
    includes: [
      'Elektronica en luchtinlaat afdekken',
      'Ontvetten en voorweken',
      'Reinigen met kwasten en lage druk',
      'Drogen met perslucht',
      'Kunststof en rubbers conserveren',
      'Motorkap binnenzijde en randen',
    ],
    benefits: [
      { title: 'Veilig', text: 'Geen hogedrukspuit op gevoelige onderdelen; elektronica wordt afgedekt.' },
      { title: 'Overzicht', text: 'Lekkages en slijtage zijn op een schone motor veel sneller te zien.' },
      { title: 'Verkoopklaar', text: 'Een verzorgde motorruimte maakt indruk bij inruil, keuring of verkoop.' },
    ],
    steps: [
      { title: 'Afkoelen & afdekken', text: 'We werken alleen aan een koude motor en dekken elektronica, zekeringkast en luchtinlaat af.' },
      { title: 'Voorweken', text: 'Een geschikte ontvetter laat vet en wegvuil loskomen.' },
      { title: 'Reinigen', text: 'Met zachte kwasten alle hoeken bewerken en met lage druk naspoelen.' },
      { title: 'Drogen & conserveren', text: 'Alles droogblazen met perslucht en kunststof en rubbers voorzien van een beschermende dressing.' },
    ],
    faq: [
      { q: 'Is het reinigen van de motorruimte niet gevaarlijk?', a: 'Niet zoals wij het doen. We werken aan een koude motor, dekken gevoelige onderdelen af, gebruiken geen hogedruk en drogen alles na met perslucht.' },
      { q: 'Kan dit bij elke auto?', a: 'Bij vrijwel alle auto’s. Bij hybrides en elektrische auto’s houden we extra rekening met hoogvoltcomponenten en laten we die onderdelen met rust.' },
      { q: 'Kan ik dit combineren met een andere behandeling?', a: 'Ja, het past goed bij een interieurreiniging of luxe handwas. Geef het aan in je aanvraag.' },
      LOCATION_FAQ,
    ],
    related: ['interieur-reiniging', 'luxe-handwas', 'polijsten'],
  },
  {
    id: 'polijsten',
    name: 'Polijsten',
    category: 'lak',
    tagline: 'Swirls en krassen weg, diepte en glans terug — zonder over te spuiten.',
    summary: 'Machinaal polijsten in één tot drie stappen om swirls, lichte krassen en doffe plekken te verwijderen.',
    intro: [
      'Swirls, wasstraatkrassen en doffe plekken ontstaan ongemerkt, maar zijn in de zon direct zichtbaar. Met machinaal polijsten halen we een flinterdun laagje blanke lak weg, zodat de krassen verdwijnen en de lak weer helder en diep glanst.',
      'Voordat we beginnen meten we de laklaagdikte, zodat we precies weten hoeveel ruimte er is. Daarna kies je samen met ons het niveau van correctie. Combineer polijsten met een glascoating om het resultaat jarenlang vast te houden.',
    ],
    fromPrice: inclVat(300),
    duration: '1 – 3 dagen',
    onLocation: false,
    image: 'polijsten',
    imageAlt: 'Detailer polijst een rode Ferrari onder werkplaatslicht',
    detailImage: { src: 'polijsten-voor-na', alt: 'Voor en na polijsten: links swirls, rechts heldere lak' },
    includes: [
      'Handwas en decontaminatie',
      'Laklaagdiktemeting',
      'Afplakken van rubbers en kunststof',
      'Polijsten in 1 tot 3 stappen',
      'Inspectie onder werkplaatslicht',
      'Advies over onderhoud',
    ],
    benefits: [
      { title: 'Zonder overspuiten', text: 'Krassen en swirls verdwijnen, de originele lak blijft behouden.' },
      { title: 'Gemeten', text: 'We meten de laklaagdikte, zodat we nooit meer weghalen dan nodig.' },
      { title: 'Specialisten', text: 'Gedaan door lakcorrectiespecialisten met oog voor ieder paneel.' },
    ],
    options: [PAINT_CORRECTION],
    steps: [
      { title: 'Inspectie', text: 'Samen bekijken we de lak onder goed licht en meten we de laklaagdikte.' },
      { title: 'Voorbereiden', text: 'Handwas, decontaminatie met klei en ijzerverwijderaar en afplakken van randen.' },
      { title: 'Polijsten', text: 'Paneel voor paneel polijsten in het gekozen aantal stappen.' },
      { title: 'Oplevering', text: 'Eindcontrole onder werkplaatslicht en uitleg over het onderhoud.' },
    ],
    faq: [
      { q: 'Hoeveel stappen heeft mijn auto nodig?', a: 'Dat hangt af van de staat van de lak en je verwachtingen. Voor de meeste auto’s is twee stappen de beste keuze. We adviseren je vooraf, eventueel op locatie.' },
      { q: 'Gaan alle krassen weg?', a: 'Krassen die door de blanke lak heen gaan — die je met je nagel voelt — kunnen we niet altijd volledig wegpolijsten. Die kunnen we wel vaak plaatselijk herstellen via schadeherstel.' },
      { q: 'Hoe lang blijft het resultaat?', a: 'Met een veilige handwas blijft de lak lang mooi. Wil je het resultaat echt vasthouden, combineer dan met een glascoating.' },
    ],
    related: ['coatings', 'ppf', 'schadeherstel'],
  },
  {
    id: 'coatings',
    name: 'Glascoating',
    category: 'lak',
    tagline: 'Tot drie jaar bescherming tegen vuil, UV en weersinvloeden.',
    summary: 'Keramische glascoating met volledige lakvoorbereiding. Waterafstotend, diepe glans en eenvoudig zelf te onderhouden, 18 of 36 maanden.',
    intro: [
      'Een glascoating is een transparante, keramische laag op basis van nanotechnologie die zich hecht aan de lak. Hij beschermt tegen vuil, UV-straling, vogelpoep en weersinvloeden en geeft de auto een diepe, natte glans.',
      'Waar wax na een paar weken is uitgewassen, gaat een coating bij goed onderhoud tot 36 maanden mee. Water parelt eraf en neemt het vuil mee, zodat wassen sneller en veiliger gaat. Omdat de coating de staat van de lak vastlegt, beginnen we altijd met een grondige voorbereiding en lakcorrectie.',
    ],
    fromPrice: inclVat(925),
    duration: '2 – 3 dagen',
    onLocation: false,
    image: 'coatings',
    imageAlt: 'Glascoating wordt uitgepoetst op een rode Ferrari',
    detailImage: { src: 'coatings-level-2', alt: 'Zwarte Porsche Cayman met diepe glans na een glascoating' },
    includes: [
      'Exterieur reiniging',
      'Decontaminatie van de lak',
      'Lakcorrectie naar keuze',
      'Coating op de lak, 18 of 36 maanden',
      'Uitharden onder gecontroleerde omstandigheden',
      'Onderhoudsadvies',
    ],
    benefits: [
      { title: 'Minder vuilhechting', text: 'Vuil en water krijgen minder grip, de auto blijft langer schoon.' },
      { title: 'Diepe glans', text: 'Meer diepte en reflectie dan wax of sealant.' },
      { title: 'Lakbescherming', text: 'Beschermt tegen UV, vogelpoep, insecten en weersinvloeden.' },
      { title: 'Makkelijk onderhoud', text: 'Wassen gaat sneller en veiliger, ook als je het zelf doet.' },
    ],
    options: [COATING_PACKAGES, PAINT_CORRECTION, COATING_EXTRAS],
    steps: [
      { title: 'Advies', text: 'We bekijken de lak samen en kiezen het pakket en de lakcorrectie die erbij passen.' },
      { title: 'Voorbereiden', text: 'Handwas, decontaminatie en het gekozen niveau van lakcorrectie.' },
      { title: 'Coaten', text: 'De lak wordt ontvet en de coating paneel voor paneel aangebracht en uitgepoetst.' },
      { title: 'Uitharden', text: 'De coating hardt uit onder gecontroleerde omstandigheden voordat de auto de weg op gaat.' },
      { title: 'Oplevering', text: 'Uitleg over wassen en onderhoud, zodat de coating zo lang mogelijk meegaat.' },
    ],
    faq: [
      { q: 'Wat is het verschil met wax?', a: 'Wax ligt op de lak en is na enkele weken uitgewassen. Een glascoating hecht zich aan de lak en gaat bij goed onderhoud 18 tot 36 maanden mee.' },
      { q: 'Wanneer mag ik de auto weer wassen?', a: 'De eerste week laat je de coating met rust. Daarna was je met de hand met een pH-neutrale shampoo. Een wasstraat raden we af.' },
      { q: 'Beschermt een coating tegen steenslag?', a: 'Nee, een coating is te dun om steenslag tegen te houden. Daarvoor is PPF (lakbeschermingsfolie) de juiste keuze; die combineren we vaak met een coating.' },
      { q: 'Is lakcorrectie verplicht?', a: 'Een coating legt de lak vast zoals hij is, inclusief swirls. Daarom zit lakcorrectie altijd in de pakketten; je kiest zelf het niveau.' },
    ],
    related: ['polijsten', 'ppf', 'handwas-abonnement'],
  },
  {
    id: 'ppf',
    name: 'PPF lakbeschermingsfolie',
    category: 'lak',
    tagline: 'Onzichtbare bescherming tegen steenslag, krassen en insecten.',
    summary: 'Transparante, zelfherstellende folie (Paint Protection Film) die de lak beschermt tegen steenslag, krassen en insecten. Van alleen de voorkant tot de hele auto.',
    intro: [
      'PPF staat voor Paint Protection Film: een dikke, kristalheldere folie van polyurethaan die over de lak wordt aangebracht. Waar een glascoating zorgt voor glans en vuilafstoting, vangt PPF de klappen op. Steenslag op de snelweg, krassen van struiken, sleutels of tassen en ingebeten insecten komen op de folie terecht in plaats van op je lak.',
      'Lichte krasjes in de folie trekken onder invloed van warmte vanzelf weer weg, bijvoorbeeld in de zon of met warm water. Goed aangebracht is de folie vrijwel onzichtbaar. Je kiest voor hoogglans, of voor satin (mat) als je de auto een zijdematte uitstraling wilt geven zonder de originele lak aan te tasten.',
      'Je bepaalt zelf hoeveel van de auto je beschermt: alleen de plekken die het zwaarst te verduren hebben, de complete voorkant, of de hele auto. Hieronder zie je per pakket precies welke delen onder de folie komen.',
    ],
    fromPrice: null,
    duration: '1 – 5 dagen',
    onLocation: false,
    image: 'ppf-folie',
    imageAlt: 'Twee specialisten houden een vel lakbeschermingsfolie boven een Porsche 911',
    detailImage: { src: 'ppf-aanbrengen', alt: 'Lakbeschermingsfolie wordt met een rakel strak op een autodeur aangebracht' },
    includes: [
      'Grondige reiniging en decontaminatie',
      'Lakcorrectie waar nodig, zodat er niets onder de folie zit',
      'Folie op maat gesneden per paneel',
      'Randen ingevouwen waar mogelijk, voor een onzichtbare afwerking',
      'Uitharden onder gecontroleerde omstandigheden',
      'Nacontrole van alle randen en onderhoudsadvies',
    ],
    benefits: [
      { title: 'Stopt steenslag', text: 'De folie vangt de inslagen op die anders direct tot op de grondlaag gaan.' },
      { title: 'Zelfherstellend', text: 'Lichte krassen en swirls in de folie verdwijnen onder invloed van warmte.' },
      { title: 'Onzichtbaar', text: 'Kristalhelder in hoogglans, of zijdemat in satin. De originele lak blijft onaangetast.' },
      { title: 'Waardebehoud', text: 'Onbeschadigde fabriekslak telt bij verkoop, inruil of het inleveren van een leaseauto.' },
    ],
    options: [
      {
        title: 'Kies je dekking',
        intro: 'Het goud laat zien waar de folie komt. De prijs hangt af van de auto en de gekozen dekking; je krijgt altijd vooraf een offerte op maat.',
        style: 'coverage',
        options: [
          {
            name: 'Partial front',
            label: 'Basis',
            coverage: 'partial',
            text: 'De plekken die het meeste steenslag vangen. Een slimme keuze voor wie vooral in de stad en op de provinciale weg rijdt.',
            items: ['Voorbumper', 'Voorste deel van de motorkap', 'Voorste deel van de spatborden', 'Spiegelkappen'],
          },
          {
            name: 'Full front',
            label: 'Meest gekozen',
            coverage: 'front',
            popular: true,
            text: 'De complete voorkant, zonder zichtbare overgang op de motorkap. Ideaal als je veel snelweg rijdt.',
            items: ['Volledige voorbumper', 'Hele motorkap', 'Hele voorspatborden', 'Spiegelkappen', 'Koplampen'],
          },
          {
            name: 'Full body',
            label: 'Maximaal',
            coverage: 'full',
            text: 'De hele auto in folie. Maximale bescherming, of een volledig satin uitstraling als je kiest voor matte folie.',
            items: ['Alle gelakte panelen', 'Deuren, dak en achterkant', 'Bumpers en dorpels', 'Spiegelkappen en koplampen'],
          },
        ],
      },
      {
        title: 'Glans of mat',
        intro: 'Dezelfde bescherming, een andere uitstraling.',
        style: 'tiles',
        options: [
          { name: 'Hoogglans', label: 'Onzichtbaar', text: 'Kristalheldere folie die je nauwelijks ziet en de lak zelfs een extra diepe glans geeft.' },
          { name: 'Satin (mat)', label: 'Zijdemat', text: 'Geeft glanzende lak een luxe, zijdematte look. Of beschermt matte fabriekslak zonder hem glanzend te maken.' },
        ],
      },
      {
        title: 'Losse delen beschermen',
        intro: 'Ook los te kiezen, of als aanvulling op een pakket.',
        style: 'tiles',
        options: [
          { name: 'Instaplijsten', text: 'Tegen schoenen en tassen bij het in- en uitstappen.' },
          { name: 'Laaddrempel', text: 'Tegen krassen bij het in- en uitladen van de kofferbak.' },
          { name: 'Deurgrepen', text: 'Tegen nagelkrassen in de uitsparing achter de handgreep.' },
          { name: 'Achter de wielen', text: 'De dorpels en zijkanten die steentjes van de eigen banden vangen.' },
        ],
      },
    ],
    comparison: {
      title: 'PPF, glascoating of wax?',
      intro: 'Ze doen elk iets anders. De beste bescherming is vaak een combinatie: PPF op de kwetsbare delen en een glascoating op de rest én op de folie.',
      columns: ['PPF', 'Glascoating', 'Wax'],
      highlight: 0,
      rows: [
        { label: 'Beschermt tegen steenslag', values: ['Ja', 'Nee', 'Nee'] },
        { label: 'Lichte krassen', values: ['Herstellen vanzelf', 'Minder snel', 'Nee'] },
        { label: 'Vuil- en waterafstotend', values: ['Ja, met coating erop', 'Ja', 'Kort'] },
        { label: 'Glans', values: ['Hoog of satin', 'Zeer hoog', 'Hoog'] },
        { label: 'Hoe lang', values: ['Jarenlang', '18 – 36 maanden', 'Enkele weken'] },
      ],
      note: 'De garantie op PPF hangt af van de gekozen folie en staat in je offerte.',
    },
    steps: [
      { title: 'Kennismaking & offerte', text: 'We bekijken de auto, bespreken de gewenste dekking en glans of mat, en sturen een offerte op maat.' },
      { title: 'Voorbereiden', text: 'Grondige handwas, decontaminatie met klei en ijzerverwijderaar. Zo zit er geen stofje onder de folie.' },
      { title: 'Lakcorrectie', text: 'De folie legt de lak vast zoals hij is. Swirls en krasjes polijsten we daarom eerst weg.' },
      { title: 'Aanbrengen', text: 'Paneel voor paneel brengen we de folie op maat aan en vouwen we randen in waar dat kan.' },
      { title: 'Uitharden & nacontrole', text: 'Na het uitharden controleren we alle randen en leggen we uit hoe je de folie onderhoudt.' },
    ],
    faq: [
      { q: 'Wat is het verschil tussen PPF en een glascoating?', a: 'Een coating is een dunne, harde laag voor glans en vuilafstoting. PPF is een dikke, flexibele folie die fysieke schade zoals steenslag opvangt. Ze vullen elkaar aan: veel klanten kiezen PPF op de voorkant en een coating op de rest van de auto.' },
      { q: 'Is de folie zichtbaar?', a: 'Nauwelijks. Bij goed aangebrachte folie zie je de randen alleen als je er heel bewust naar zoekt. Bij een full front of full body vallen er ook op de motorkap geen overgangen.' },
      { q: 'Moet mijn auto nieuw zijn?', a: 'Nee, PPF kan op elke auto. Wel blijft bestaande schade onder de folie zichtbaar. Daarom polijsten we de lak eerst, en herstellen we steenslag of deukjes waar nodig.' },
      { q: 'Hoe lang staat mijn auto bij jullie?', a: 'Een partial front is meestal binnen een dag klaar, een full front in één à twee dagen en een full body in drie tot vijf dagen, inclusief voorbereiding en uitharden.' },
      { q: 'Hoe onderhoud ik PPF?', a: 'Was de auto de eerste week niet en daarna gewoon met de hand met een pH-neutrale shampoo. Richt een hogedrukspuit niet van dichtbij op de randen. Een wasstraat raden we af.' },
      { q: 'Kan de folie er later weer af?', a: 'Ja. Kwalitatieve PPF kan worden verwijderd zonder de originele fabriekslak te beschadigen. Daarom is het ook populair bij leaseauto’s.' },
      { q: 'Hoe lang gaat PPF mee?', a: 'Kwalitatieve folie gaat jarenlang mee en vergeelt niet. De exacte garantietermijn hangt af van de gekozen folie; die staat in je offerte.' },
    ],
    related: ['coatings', 'polijsten', 'schadeherstel'],
  },
  {
    id: 'schadeherstel',
    name: 'Schadeherstel',
    category: 'herstel',
    tagline: 'Deuken, krassen en lakschade vakkundig hersteld.',
    summary: 'Herstel van kleine tot middelgrote schade: deuken uitdeuken zonder spuiten, steenslag, krassen en plaatselijk spuitwerk.',
    intro: [
      'Een deukje van een winkelwagen, een kras langs de zijkant of steenslag op de motorkap: kleine schade is vervelend, maar hoeft geen groot of duur herstel te zijn. We kiezen altijd de methode waarbij zoveel mogelijk van de originele lak behouden blijft.',
      'Deuken zonder lakschade drukken we van achteren terug met uitdeuken zonder spuiten (PDR). Is de lak wel beschadigd, dan herstellen we plaatselijk met spot repair of spuiten we het onderdeel opnieuw in de originele kleur.',
    ],
    fromPrice: null,
    duration: 'In overleg',
    onLocation: false,
    image: 'schadeherstel',
    imageAlt: 'Spuiter brengt lak aan op een autopaneel',
    detailImage: { src: 'schadeherstel-deuken', alt: 'Deuken in een blauw autopaneel, zichtbaar in de reflectie' },
    includes: [
      'Uitdeuken zonder spuiten (PDR)',
      'Steenslag herstellen',
      'Krassen en lakschade bijwerken',
      'Spot repair en onderdelen spuiten',
      'Hagelschade herstellen',
      'Kleur exact afgestemd op de originele lak',
    ],
    benefits: [
      { title: 'Origineel waar het kan', text: 'We herstellen in plaats van vervangen en behouden zoveel mogelijk fabriekslak.' },
      { title: 'Juiste methode', text: 'Uitdeuken, spot repair of spuiten — afhankelijk van de schade.' },
      { title: 'Naadloos', text: 'Na herstel polijsten we het paneel, zodat je het verschil niet ziet.' },
    ],
    steps: [
      { title: 'Schadeanalyse', text: 'We bekijken de schade en bepalen of de lak beschadigd is.' },
      { title: 'Offerte', text: 'Je krijgt een heldere offerte op maat, zonder verrassingen achteraf.' },
      { title: 'Methode kiezen', text: 'Uitdeuken zonder spuiten, spot repair of een onderdeel opnieuw spuiten.' },
      { title: 'Herstel', text: 'Het herstel wordt uitgevoerd en daarna gepolijst en afgewerkt.' },
      { title: 'Oplevering', text: 'We lopen het resultaat samen met je na.' },
    ],
    faq: [
      { q: 'Wat kost schadeherstel?', a: 'Dat hangt sterk af van de schade. Stuur een paar duidelijke foto’s mee met je aanvraag, dan geven we snel een eerste inschatting.' },
      { q: 'Wat is uitdeuken zonder spuiten?', a: 'Bij PDR (Paintless Dent Repair) drukken we de deuk met speciaal gereedschap van achteren terug. De lak blijft intact, dus er hoeft niet gespoten te worden.' },
      { q: 'Kunnen jullie hagelschade herstellen?', a: 'Ja, hagelschade herstellen we meestal met uitdeuken zonder spuiten. Vraag gerust een inspectie aan.' },
    ],
    related: ['polijsten', 'ppf', 'coatings'],
  },
];

export function getService(id: string): Service | undefined {
  return SERVICES.find((s) => s.id === id && !s.hidden);
}

/** Also finds hidden services, for old bookings and e-mails. */
export function findService(id: string): Service | undefined {
  return SERVICES.find((s) => s.id === id);
}

/** Services shown on the site. */
export function listedServices(): Service[] {
  return SERVICES.filter((s) => !s.hidden);
}

export function servicesIn(category: ServiceCategory): Service[] {
  return listedServices().filter((s) => s.category === category);
}

/** "vanaf € 72,60" or "Prijs op aanvraag". */
export function servicePriceLabel(service: Pick<Service, 'fromPrice'>): string {
  return service.fromPrice === null ? 'Prijs op aanvraag' : `vanaf ${formatPrice(service.fromPrice)}`;
}

/** Meta description for a service page, shared by the browser and the server. */
export function serviceMetaDescription(service: Service): string {
  const price = servicePriceLabel(service);
  return `${service.summary} ${price.charAt(0).toUpperCase()}${price.slice(1)}${service.fromPrice === null ? '' : ' incl. btw'}.`;
}

/** Service name for use mid-sentence: "luxe handwas", but "PPF lakbeschermingsfolie" keeps its acronym. */
export function nameInSentence(service: Pick<Service, 'name'>): string {
  return /^[A-Z]{2}/.test(service.name) ? service.name : service.name.charAt(0).toLowerCase() + service.name.slice(1);
}
