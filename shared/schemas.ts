// Validation for everything edited in the admin. Kept apart from the content so the public pages
// do not have to download the validation library.
import { z } from 'zod';
import { BUILTIN_IMAGES } from './content';
import { EMAIL_KINDS, EMAIL_TEMPLATES } from './email';
import { COUNTRIES } from './pricing';

const text = (max: number, label = 'Dit veld') => z.string().trim().min(1, `${label} mag niet leeg zijn`).max(max, `Maximaal ${max} tekens`);
const optionalText = (max: number) => z.string().trim().max(max, `Maximaal ${max} tekens`);
const list = <T extends z.ZodTypeAny>(item: T, max: number) => z.array(item).max(max, `Maximaal ${max} regels`);

/** An uploaded image (m_…), a built-in photo name, a file under public/ or an Unsplash URL. */
export const imageRef = z
  .string()
  .trim()
  .max(300)
  .refine(
    (v) =>
      /^m_[a-z0-9]{16}$/.test(v) ||
      (BUILTIN_IMAGES as readonly string[]).includes(v) ||
      /^\/[a-z0-9/_-]+\.(jpg|jpeg|png|webp)$/i.test(v) ||
      /^https:\/\/images\.unsplash\.com\/[\w\-./?=&%]+$/.test(v),
    'Kies een afbeelding uit de mediabibliotheek',
  );

const httpsUrl = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === '' || /^https:\/\/[^\s<>"]+$/.test(v), 'Vul een link in die begint met https://');

const euroCents = z.number().int('Vul een bedrag in').min(0, 'Het bedrag kan niet negatief zijn').max(10_000_000, 'Dit bedrag is te hoog');

export const siteSchema = z
  .object({
    tagline: text(120, 'De slogan'),
    description: text(300, 'De omschrijving'),
    region: text(80, 'Het werkgebied'),
    legalName: text(120, 'De bedrijfsnaam'),
    address: z.object({ street: optionalText(120), postalCode: optionalText(10), city: text(80, 'De plaats'), country: text(60, 'Het land') }),
    phone: z.string().trim().regex(/^[+\d][\d\s-]{7,18}$/, 'Vul een geldig telefoonnummer in, bijv. 06 12 34 56 78'),
    email: z.email('Vul een geldig e-mailadres in').max(200),
    kvk: z.string().trim().regex(/^\d{8}$/, 'Een KvK-nummer heeft 8 cijfers'),
    vatNumber: z.string().trim().toUpperCase().regex(/^NL\d{9}B\d{2}$/, 'Bijv. NL123456789B01'),
    hours: list(z.object({ days: text(40, 'De dag'), time: text(40, 'De tijd') }), 10),
    social: z.object({ instagram: httpsUrl, tiktok: httpsUrl }),
  })
  .strict();

const pair = z.object({ title: text(80, 'De titel'), text: text(400, 'De tekst') });
const qa = z.object({ q: text(200, 'De vraag'), a: text(1500, 'Het antwoord') });

export const homeSchema = z
  .object({
    heroTitle: text(80, 'De titel'),
    heroText: text(300, 'De tekst'),
    heroImage: imageRef,
    servicesTitle: text(80, 'De titel'),
    servicesIntro: text(300, 'De tekst'),
    shopTitle: text(80, 'De titel'),
    shopIntro: text(300, 'De tekst'),
    stepsTitle: text(80, 'De titel'),
    steps: list(pair, 6).min(1, 'Voeg minimaal één stap toe'),
    resultsTitle: text(80, 'De titel'),
    resultsIntro: text(300, 'De tekst'),
    results: list(
      z.preprocess(
        // Older saves had a single `image`; turn it into a one-photo series.
        (v) => (v && typeof v === 'object' && 'image' in v && !('images' in v) ? { ...v, images: [(v as { image: unknown }).image], image: undefined } : v),
        z.object({
          images: list(imageRef, 12).min(1, 'Voeg minimaal één foto toe'),
          title: text(80, 'De titel'),
          text: text(160, 'De omschrijving'),
        }),
      ),
      8,
    ),
    faqTitle: text(80, 'De titel'),
    faq: list(qa, 20),
    ctaTitle: text(80, 'De titel'),
    ctaText: text(200, 'De tekst'),
  })
  .strict();

export const serviceSchema = z
  .object({
    hidden: z.boolean(),
    name: text(60, 'De naam'),
    tagline: text(160, 'De slogan'),
    summary: text(300, 'De samenvatting'),
    intro: list(text(1500, 'Een alinea'), 6).min(1, 'Schrijf minimaal één alinea'),
    fromPrice: euroCents.nullable(),
    duration: text(40, 'De duur'),
    onLocation: z.boolean(),
    image: imageRef,
    imageAlt: optionalText(160),
    includes: list(text(120, 'Een regel'), 12),
    benefits: list(pair, 6),
    steps: list(pair, 8),
    faq: list(qa, 12),
  })
  .strict();

const slug = z
  .string()
  .trim()
  .min(2, 'Vul een webadres in')
  .max(80)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Alleen kleine letters, cijfers en streepjes');

export const productSchema = z
  .object({
    id: slug,
    slug,
    sku: z.string().trim().min(2, 'Vul een artikelnummer in').max(40).regex(/^[A-Za-z0-9._-]+$/, 'Alleen letters, cijfers, punten en streepjes'),
    name: text(80, 'De naam'),
    category: text(40, 'De categorie'),
    tagline: text(200, 'De korte omschrijving'),
    description: list(text(2000, 'Een alinea'), 8).min(1, 'Schrijf minimaal één alinea'),
    price: euroCents.min(1, 'Vul een prijs in'),
    compareAtPrice: euroCents.optional(),
    size: text(40, 'De inhoud of maat'),
    highlights: list(text(120, 'Een regel'), 10),
    specs: list(z.object({ label: text(40, 'Het kenmerk'), value: text(160, 'De waarde') }), 15),
    usage: list(text(300, 'Een stap'), 12),
    includes: list(z.object({ productId: slug, quantity: z.number().int().min(1).max(20) }), 10).optional(),
    badge: optionalText(40).optional(),
    image: imageRef.optional(),
    inStock: z.boolean(),
    hidden: z.boolean().optional(),
  })
  .strict();


export const postSchema = z
  .object({
    title: z.string().trim().min(1, 'Geef je bericht een titel').max(140, 'Maximaal 140 tekens'),
    slug: z
      .string()
      .trim()
      .min(2, 'Vul een webadres in')
      .max(80, 'Maximaal 80 tekens')
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Alleen kleine letters, cijfers en streepjes'),
    excerpt: z.string().trim().max(300, 'Maximaal 300 tekens'),
    body: z.string().max(50_000, 'Dit bericht is te lang'),
    cover: imageRef.nullable(),
    status: z.enum(['draft', 'published']),
    /** ISO date (yyyy-mm-dd). A date in the future schedules the post. */
    publishedAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Kies een geldige datum')
      .nullable(),
  })
  .strict();

export type PostInput = z.infer<typeof postSchema>;

export const teamMemberSchema = z
  .object({
    name: text(80, 'De naam'),
    role: text(80, 'De rol'),
    bio: z.string().trim().max(4000, 'Maximaal 4000 tekens'),
    quote: optionalText(200),
    photo: imageRef.nullable(),
    facts: list(z.object({ label: text(40, 'Het onderwerp'), value: text(80, 'De waarde') }), 4),
    visible: z.boolean(),
  })
  .strict();

export type TeamMemberInput = z.infer<typeof teamMemberSchema>;

const countryRate = z.object({
  enabled: z.boolean(),
  cost: euroCents,
  freeFrom: euroCents.nullable(),
});

export const shippingSchema = z
  .object({
    deliveryEnabled: z.boolean(),
    carrier: text(40, 'De vervoerder'),
    dispatchDays: text(40, 'De verzendtijd'),
    countries: z.object(Object.fromEntries(COUNTRIES.map((c) => [c, countryRate])) as Record<(typeof COUNTRIES)[number], typeof countryRate>),
    pickup: z.object({
      enabled: z.boolean(),
      cost: euroCents,
      location: optionalText(200),
      readyTime: text(80, 'Wanneer het klaarligt'),
      instructions: optionalText(500),
    }),
  })
  .strict()
  .refine((v) => v.pickup.enabled || (v.deliveryEnabled && Object.values(v.countries).some((c) => c.enabled)), {
    path: ['deliveryEnabled'],
    message: 'Zet minstens één manier aan, anders kan niemand meer bestellen.',
  });

const emailText = z.object({
  subject: text(150, 'Het onderwerp'),
  preheader: optionalText(150),
  heading: text(120, 'De kop'),
  intro: text(2000, 'De tekst'),
  button: optionalText(40),
  closing: optionalText(1000),
});

export const emailSchema = z
  .object({
    design: z.object({
      template: z.enum(EMAIL_TEMPLATES),
      accent: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Kies een kleur, bijv. #d9a72a'),
      rounded: z.boolean(),
      headerImage: imageRef,
      footerText: optionalText(200),
      showSocial: z.boolean(),
    }),
    texts: z.object(Object.fromEntries(EMAIL_KINDS.map((k) => [k, emailText])) as Record<(typeof EMAIL_KINDS)[number], typeof emailText>),
  })
  .strict();

export const aboutSchema = z
  .object({
    homeTitle: text(100, 'De titel'),
    homeText: text(800, 'De tekst'),
    image: imageRef,
    heroTitle: text(100, 'De titel'),
    heroText: text(300, 'De tekst'),
    storyTitle: text(80, 'De titel'),
    story: list(text(1500, 'Een alinea'), 8).min(1, 'Schrijf minimaal één alinea'),
    quote: optionalText(200),
    whyTitle: text(80, 'De titel'),
    whyText: text(1500, 'De tekst'),
    values: list(z.object({ title: text(60, 'De titel'), text: text(300, 'De uitleg') }), 6),
    facts: list(z.object({ value: text(20, 'Het getal of woord'), label: text(80, 'De uitleg') }), 4),
  })
  .strict();

export const shopSchema = z.object({ enabled: z.boolean() }).strict();
