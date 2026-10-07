// Product catalog shared by the storefront and the server.
// The server always recalculates prices from this file, so changing a price
// here is the only thing needed to change what customers pay.
// All amounts are in euro cents, including 21% BTW.

export type ProductId = 'interior-cleaner' | 'interior-brush' | 'microfiber-towel' | 'interior-kit';

export type Product = {
  id: ProductId;
  slug: string;
  sku: string;
  name: string;
  category: string;
  tagline: string;
  description: string[];
  price: number;
  /** Price of the separate items, shown as "los" price for bundles. */
  compareAtPrice?: number;
  size: string;
  highlights: string[];
  specs: { label: string; value: string }[];
  usage: string[];
  /** For bundles: which products are in the box. */
  includes?: { productId: ProductId; quantity: number }[];
  badge?: string;
  /** Set to false to show the product as sold out. */
  inStock: boolean;
};

export const PRODUCTS: Product[] = [
  {
    id: 'interior-kit',
    slug: 'interior-care-kit',
    sku: 'LUM-KIT-01',
    name: 'Interior Care Kit',
    category: 'Set',
    tagline: 'Cleaner, borstel en doek — alles voor een strak interieur.',
    description: [
      'Dezelfde drie producten die wij dagelijks in de studio gebruiken, samen in één set. Spuit, borstel los, neem af: klaar.',
      'De set is samengesteld voor het onderhoud tussen twee professionele behandelingen in, maar werkt net zo goed als startpakket voor wie zelf het interieur wil verzorgen.',
    ],
    price: 2995,
    compareAtPrice: 3785,
    size: '3 producten',
    highlights: ['Interior Cleaner 500 ml', 'Interior Detailing Brush', 'Microvezel doek 40 × 40 cm', 'Voordeliger dan los'],
    specs: [
      { label: 'Inhoud', value: 'Cleaner 500 ml, borstel, microvezel doek' },
      { label: 'Geschikt voor', value: 'Kunststof, vinyl, rubber, stof en leer' },
      { label: 'Artikelnummer', value: 'LUM-KIT-01' },
    ],
    usage: [
      'Spuit de cleaner op de borstel of direct op het oppervlak.',
      'Werk het vuil los met de borstel, ook in naden en ventilatieroosters.',
      'Neem af met de droge microvezel doek.',
    ],
    includes: [
      { productId: 'interior-cleaner', quantity: 1 },
      { productId: 'interior-brush', quantity: 1 },
      { productId: 'microfiber-towel', quantity: 1 },
    ],
    badge: 'Bespaar € 7,90',
    inStock: true,
  },
  {
    id: 'interior-cleaner',
    slug: 'interior-cleaner',
    sku: 'LUM-IC-500',
    name: 'Interior Cleaner',
    category: 'Reiniger',
    tagline: 'Reinigt dashboard, deurpanelen en bekleding zonder glans of vettig laagje.',
    description: [
      'Onze Interior Cleaner verwijdert vingerafdrukken, stof, vlekken en vuil van alle harde en zachte oppervlakken in het interieur. Het resultaat is een schone, matte fabrieksafwerking — geen plakkerige glans.',
      'De formule is veilig voor kunststof, vinyl, rubber, stof en leer, en droogt streeploos op. Ook geschikt voor schermen met een anti-reflectielaag wanneer je op de doek spuit.',
    ],
    price: 1695,
    size: '500 ml',
    highlights: ['Matte, streeploze afwerking', 'Voor harde én zachte oppervlakken', 'Frisse, neutrale geur', 'Klaar voor gebruik'],
    specs: [
      { label: 'Inhoud', value: '500 ml spuitflacon' },
      { label: 'Geschikt voor', value: 'Kunststof, vinyl, rubber, stof en leer' },
      { label: 'Afwerking', value: 'Mat, geen glans' },
      { label: 'Artikelnummer', value: 'LUM-IC-500' },
    ],
    usage: [
      'Goed schudden voor gebruik.',
      'Spuit op de borstel of doek, of direct op het oppervlak.',
      'Werk het vuil los en neem na met een schone, droge microvezel doek.',
      'Bij gevoelige materialen eerst op een onopvallende plek testen.',
    ],
    inStock: true,
  },
  {
    id: 'interior-brush',
    slug: 'interior-detailing-brush',
    sku: 'LUM-BR-01',
    name: 'Interior Detailing Brush',
    category: 'Borstel',
    tagline: 'Zachte haren voor naden, knoppen en ventilatieroosters.',
    description: [
      'Een borstel met zachte, dichte haren die vuil uit naden, stiknaden, knoppen en ventilatieroosters haalt zonder krassen op hoogglans kunststof of schermen.',
      'De ergonomische steel ligt goed in de hand en de haren houden hun vorm, ook na veel gebruik met reinigingsmiddel.',
    ],
    price: 1295,
    size: '1 stuk',
    highlights: ['Krasvrij op hoogglans en schermen', 'Bereikt naden en roosters', 'Vormvaste haren', 'Uitwasbaar'],
    specs: [
      { label: 'Haren', value: 'Zacht synthetisch' },
      { label: 'Gebruik', value: 'Dashboard, roosters, naden, leer' },
      { label: 'Onderhoud', value: 'Uitspoelen met lauw water, laten drogen' },
      { label: 'Artikelnummer', value: 'LUM-BR-01' },
    ],
    usage: [
      'Spuit Interior Cleaner op de haren.',
      'Borstel met lichte druk in kleine cirkels.',
      'Neem het losgemaakte vuil op met een microvezel doek.',
      'Spoel de borstel na gebruik uit en laat hem met de haren naar beneden drogen.',
    ],
    inStock: true,
  },
  {
    id: 'microfiber-towel',
    slug: 'microvezel-doek',
    sku: 'LUM-MF-40',
    name: 'Microvezel doek',
    category: 'Doek',
    tagline: 'Randloze doek die vuil opneemt in plaats van het rond te duwen.',
    description: [
      'Een randloze microvezel doek van 40 × 40 cm. Zonder stikrand, dus geen risico op krassen op hoogglans afwerkingen en schermen.',
      'Neemt vuil en reinigingsmiddel op en laat geen pluisjes of strepen achter. Wasbaar en lang mee te gaan.',
    ],
    price: 795,
    size: '40 × 40 cm',
    highlights: ['Randloos, zonder stikrand', 'Pluisvrij en streeploos', 'Hoge opname', 'Wasbaar tot 40 °C'],
    specs: [
      { label: 'Afmeting', value: '40 × 40 cm' },
      { label: 'Rand', value: 'Randloos (lasergesneden)' },
      { label: 'Wassen', value: 'Max. 40 °C, zonder wasverzachter' },
      { label: 'Artikelnummer', value: 'LUM-MF-40' },
    ],
    usage: [
      'Vouw de doek in vieren voor acht schone werkvlakken.',
      'Neem af met lichte druk, draai naar een schone kant als de doek vuil wordt.',
      'Wassen op max. 40 °C zonder wasverzachter, niet strijken.',
    ],
    inStock: true,
  },
];

export const BUNDLE_ID: ProductId = 'interior-kit';

export function getProduct(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

export function getProductBySlug(slug: string): Product | undefined {
  return PRODUCTS.find((p) => p.slug === slug);
}
