// Editable site content. The objects exported by site.ts, services.ts, catalog.ts and HOME below hold
// the defaults; changes made in the admin are stored as a ContentDoc and applied on top of them,
// on the server at start-up and in the browser before the first render.
import { PRODUCTS, type Product } from './catalog';
import { EMAIL, type EmailSettings } from './email';
import { COUNTRIES, DELIVERY, PICKUP, SHIPPING, type Country, type PickupOption } from './pricing';
import { SERVICES, type Service } from './services';
import { phoneToHref, SITE, type SiteInfo } from './site';

export type HomeContent = {
  heroTitle: string;
  heroText: string;
  heroImage: string;
  servicesTitle: string;
  servicesIntro: string;
  shopTitle: string;
  shopIntro: string;
  stepsTitle: string;
  steps: { title: string; text: string }[];
  resultsTitle: string;
  resultsIntro: string;
  /** Recent projects, each with one or more photos to swipe through. */
  results: { images: string[]; title: string; text: string }[];
  faqTitle: string;
  faq: { q: string; a: string }[];
  ctaTitle: string;
  ctaText: string;
};

export type AboutContent = {
  /** Homepage section. */
  homeTitle: string;
  homeText: string;
  image: string;
  /** /over-ons page. */
  heroTitle: string;
  heroText: string;
  storyTitle: string;
  story: string[];
  quote: string;
  whyTitle: string;
  whyText: string;
  values: { title: string; text: string }[];
  facts: { value: string; label: string }[];
};

/** The webshop as a whole. Switched off, the shop, cart and checkout disappear from the site. */
export type ShopSettings = { enabled: boolean };
export const SHOP: ShopSettings = { enabled: true };

export const ABOUT: AboutContent = {
  homeTitle: 'Twee autoliefhebbers, één standaard.',
  homeText:
    'Detail2Go is opgericht door Damiën van der Veen en Stein Veldman. Wat begon als een gedeelde passie voor auto’s, is uitgegroeid tot een detailingbedrijf dat draait om precisie, vakmanschap en eerlijk advies. Iedere auto behandelen we alsof het onze eigen is.',
  image: 'team',
  heroTitle: 'Passie voor auto’s,\ntot in het kleinste detail.',
  heroText: 'Wij zijn Detail2Go: twee jonge autoliefhebbers uit Twente die van autoverzorging hun vak hebben gemaakt.',
  storyTitle: 'Ons verhaal',
  story: [
    'Detail2Go is opgericht door Damiën van der Veen en Stein Veldman. Wat begon als een gedeelde passie voor auto’s, is uitgegroeid tot een eigen detailingbedrijf in Enschede en omstreken.',
    'We zagen dat goede autoverzorging vaak onpersoonlijk is, of veel gedoe kost: auto wegbrengen, wachten, weer ophalen. Dat kan beter. Daarom komen we naar je toe, werken we met de beste producten en nemen we de tijd die je auto verdient.',
    'Iedere klant hoort bij de Detail2Go-familie. Dat betekent: eerlijk advies, heldere afspraken vooraf en een resultaat waar we zelf trots op zijn.',
  ],
  quote: 'Iedere auto behandelen we alsof het onze eigen is.',
  whyTitle: 'Waarom we het doen',
  whyText:
    'Voor ons is een auto meer dan vervoer. Het is iets waar je trots op bent, waar je in investeert en waar je elke dag in stapt. Dan mag hij er ook zo uitzien. Niets geeft ons meer voldoening dan het moment dat een klant zijn auto terugziet en even stil wordt.',
  values: [
    { title: 'Zorgvuldig', text: 'Precisie en vakmanschap bij elke behandeling. We zien wat anderen missen, en lossen het op.' },
    { title: 'Wij komen naar je toe', text: 'Bij jou op de oprit of op je werk. Jij verliest geen tijd, wij nemen alles mee.' },
    { title: 'Eerlijk advies', text: 'We vertellen vooraf wat haalbaar is en wat het kost. Ook als dat betekent dat iets niet nodig is.' },
    { title: 'Eén aanspreekpunt', text: 'Van een wasbeurt tot een compleet project: je regelt alles via ons. Wij denken mee en houden je op de hoogte.' },
  ],
  facts: [
    { value: '2', label: 'oprichters met passie voor auto’s' },
    { value: 'Twente', label: 'Enschede en omstreken' },
    { value: '100%', label: 'handwerk, geen wasstraat' },
    { value: 'Op locatie', label: 'of in onze eigen werkplaats' },
  ],
};

export const HOME: HomeContent = {
  heroTitle: 'Tot in het\nkleinste detail.',
  heroText: 'Van luxe handwas tot glascoating en PPF. Bij jou op de oprit of in onze werkplaats, met een heldere prijsopgave vooraf.',
  heroImage: 'hero',
  servicesTitle: 'Van wasbeurt tot lakbescherming.',
  servicesIntro: 'Iedere behandeling begint met een eerlijke inspectie. We vertellen vooraf wat haalbaar is, wat het kost en hoe lang het duurt.',
  shopTitle: 'Onze favoriete producten, nu voor thuis.',
  shopIntro: 'Dezelfde producten die wij dagelijks gebruiken. Voor het onderhoud tussen twee behandelingen in, of als je zelf aan de slag wilt.',
  stepsTitle: 'Van aanvraag tot oplevering.',
  steps: [
    { title: 'Aanvraag', text: 'Vraag online een afspraak aan. Je hoort binnen één werkdag van ons met een voorstel voor datum en prijs.' },
    { title: 'Inspectie', text: 'We bekijken de auto samen, meten de laklaagdikte waar nodig en vertellen eerlijk wat haalbaar is.' },
    { title: 'Behandeling', text: 'Bij jou op locatie of in onze werkplaats, met de tijd en aandacht die de behandeling nodig heeft.' },
    { title: 'Oplevering', text: 'We lopen het resultaat samen na en geven advies, zodat je auto lang zo mooi blijft.' },
  ],
  resultsTitle: 'Recent opgeleverd.',
  resultsIntro: 'Een greep uit het werk van de afgelopen maanden. Meer projecten zie je op Instagram.',
  results: [
    { images: ['coatings-level-2', 'ppf'], title: 'Porsche Cayman', text: 'Lakcorrectie en glascoating' },
    { images: ['luxe-handwas-rsq8', 'handwas-abonnement'], title: 'Audi RS Q8', text: 'Luxe handwas op locatie' },
  ],
  faqTitle: 'Goed om te weten.',
  faq: [
    {
      q: 'Hoe vraag ik een afspraak aan?',
      a: 'Via het aanvraagformulier op deze site, telefonisch, via WhatsApp of per e-mail. We nemen binnen één werkdag contact op om de datum en de prijs te bevestigen. Pas daarna staat de afspraak vast.',
    },
    {
      q: 'Komen jullie ook bij mij thuis?',
      a: 'Ja. Wassen, interieurreiniging, de technische ruimte en het handwas abonnement doen we ook op locatie in Enschede en omstreken. We hebben dan een stroom- en wateraansluiting en wat ruimte rondom de auto nodig. Polijsten, coatings, PPF en schadeherstel doen we in onze werkplaats.',
    },
    {
      q: 'Waarom staan er vanaf-prijzen?',
      a: 'De prijs hangt af van het formaat en de staat van de auto. Je krijgt altijd vooraf een prijsopgave; stuur gerust een paar foto’s mee met je aanvraag voor een nauwkeurige inschatting.',
    },
    {
      q: 'Hoe lang ben ik mijn auto kwijt?',
      a: 'Een wasbeurt of interieurbehandeling is binnen een dagdeel klaar. Polijsten en coatings duren één tot drie dagen, omdat een coating ook moet uitharden voordat de auto de weg op gaat.',
    },
  ],
  ctaTitle: 'Klaar om je auto te laten stralen?',
  ctaText: 'Vraag een afspraak aan en je hoort binnen één werkdag van ons.',
};

/** Photos that ship with the site (public/services), selectable in the admin next to uploads. */
export const BUILTIN_IMAGES = [
  'hero', 'coatings', 'coatings-level-1', 'coatings-level-2', 'polijsten', 'polijsten-voor-na', 'polijsten-stap-1', 'polijsten-stap-2',
  'luxe-handwas', 'luxe-handwas-rsq8', 'handwas-op-locatie', 'handwas-op-locatie-velg', 'handwas-abonnement', 'interieur-reiniging',
  'interieur-reiniging-dashboard', 'interieur-reiniging-leer', 'schadeherstel', 'schadeherstel-deuken', 'ppf', 'ppf-folie', 'ppf-aanbrengen', 'ppf-motorkap', 'team', 'technische-ruimte',
] as const;

// --- What can be edited ------------------------------------------------------------

export const SERVICE_FIELDS = [
  'hidden', 'name', 'tagline', 'summary', 'intro', 'fromPrice', 'duration', 'onLocation', 'image', 'imageAlt', 'includes', 'benefits', 'steps', 'faq',
] as const;
export type ServiceEdit = Pick<Service, (typeof SERVICE_FIELDS)[number]>;

export const SITE_FIELDS = [
  'tagline', 'description', 'region', 'legalName', 'address', 'phone', 'email', 'kvk', 'vatNumber', 'hours', 'social',
] as const;
export type SiteEdit = Pick<SiteInfo, (typeof SITE_FIELDS)[number]>;

export type ShippingContent = {
  deliveryEnabled: boolean;
  carrier: string;
  dispatchDays: string;
  countries: Record<Country, { enabled: boolean; cost: number; freeFrom: number | null }>;
  pickup: PickupOption;
};

export function shippingEdit(): ShippingContent {
  return {
    deliveryEnabled: DELIVERY.enabled,
    carrier: SITE.carrier,
    dispatchDays: SITE.dispatchDays,
    countries: Object.fromEntries(
      COUNTRIES.map((c) => [c, { enabled: SHIPPING[c].enabled, cost: SHIPPING[c].cost, freeFrom: SHIPPING[c].freeFrom }]),
    ) as ShippingContent['countries'],
    pickup: { ...PICKUP },
  };
}

export type ContentDoc = {
  site?: SiteEdit;
  shipping?: ShippingContent;
  /** Design and texts of the e-mails (server only). */
  email?: EmailSettings;
  home?: HomeContent;
  about?: AboutContent;
  shop?: ShopSettings;
  services?: Record<string, ServiceEdit>;
  /** The full product list once it has been edited in the admin. */
  products?: Product[];
};

// --- Applying ----------------------------------------------------------------------

const DEFAULTS = {
  email: structuredClone(EMAIL),
  shipping: shippingEdit(),
  site: structuredClone(SITE),
  home: structuredClone(HOME),
  about: structuredClone(ABOUT),
  shop: structuredClone(SHOP),
  services: structuredClone(SERVICES),
  products: structuredClone(PRODUCTS),
};

export function defaultContent() {
  return structuredClone(DEFAULTS);
}

function replaceContents<T extends object>(target: T, source: T) {
  for (const key of Object.keys(target)) delete (target as Record<string, unknown>)[key];
  Object.assign(target, source);
}

/** Resets the shared objects to their defaults and applies the stored changes. Safe to call repeatedly. */
export function applyContent(doc: ContentDoc = {}) {
  const site = { ...structuredClone(DEFAULTS.site), ...structuredClone(doc.site ?? {}) } as SiteInfo;
  site.phoneHref = phoneToHref(site.phone);
  site.whatsapp = `https://wa.me/${site.phoneHref.replace(/^\+/, '')}`;
  replaceContents(SITE, site);

  replaceContents(HOME, { ...structuredClone(DEFAULTS.home), ...structuredClone(doc.home ?? {}) });
  replaceContents(ABOUT, { ...structuredClone(DEFAULTS.about), ...structuredClone(doc.about ?? {}) });
  replaceContents(SHOP, { ...DEFAULTS.shop, ...(doc.shop ?? {}) });

  SERVICES.forEach((service, i) => {
    replaceContents(service, { ...structuredClone(DEFAULTS.services[i]), ...structuredClone(doc.services?.[service.id] ?? {}) });
  });

  PRODUCTS.splice(0, PRODUCTS.length, ...structuredClone(doc.products ?? DEFAULTS.products));

  const shipping = structuredClone(doc.shipping ?? DEFAULTS.shipping);
  DELIVERY.enabled = shipping.deliveryEnabled;
  SITE.carrier = shipping.carrier;
  SITE.dispatchDays = shipping.dispatchDays;
  for (const c of COUNTRIES) Object.assign(SHIPPING[c], shipping.countries[c]);
  replaceContents(PICKUP, shipping.pickup);

  const email = structuredClone(doc.email ?? DEFAULTS.email);
  EMAIL.design = { ...DEFAULTS.email.design, ...email.design };
  EMAIL.texts = { ...structuredClone(DEFAULTS.email.texts), ...email.texts };
}

/** The editable part of each service, as shown in the admin. */
export function serviceEdit(service: Service): ServiceEdit {
  const out = {} as Record<string, unknown>;
  for (const key of SERVICE_FIELDS) out[key] = service[key] ?? (key === 'hidden' ? false : undefined);
  return out as ServiceEdit;
}

export function siteEdit(site: SiteInfo): SiteEdit {
  const out = {} as Record<string, unknown>;
  for (const key of SITE_FIELDS) out[key] = site[key];
  return out as SiteEdit;
}
