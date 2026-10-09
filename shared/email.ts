// E-mail design and texts, edited in the admin (E-mails). These are the defaults; rendering lives in
// server/mailTemplates.ts. Texts may contain placeholders like {voornaam} that are filled per mail.

export const EMAIL_TEMPLATES = ['klassiek', 'licht', 'foto'] as const;
export type EmailTemplate = (typeof EMAIL_TEMPLATES)[number];

export const TEMPLATE_INFO: Record<EmailTemplate, { name: string; description: string }> = {
  klassiek: { name: 'Klassiek', description: 'Donkere kop met je logo, lichte achtergrond en een gouden knop. Past bij de website.' },
  licht: { name: 'Licht', description: 'Wit en rustig, met een dunne gekleurde lijn bovenaan. Leest als een persoonlijke mail.' },
  foto: { name: 'Foto', description: 'Opent met een grote foto van je werk. Opvallend en luxe.' },
};

export type EmailDesign = {
  template: EmailTemplate;
  /** Hex colour of buttons and highlights, e.g. #d9a72a. */
  accent: string;
  rounded: boolean;
  /** Photo at the top of the "foto" template. */
  headerImage: string;
  /** Short line under the logo in the footer. */
  footerText: string;
  showSocial: boolean;
};

export const EMAIL_KINDS = ['orderConfirmation', 'orderShipped', 'orderReady', 'bookingReceived'] as const;
export type EmailKind = (typeof EMAIL_KINDS)[number];

export type EmailText = {
  subject: string;
  /** Short line shown next to the subject in the inbox. */
  preheader: string;
  heading: string;
  intro: string;
  button: string;
  closing: string;
};

export type EmailSettings = { design: EmailDesign; texts: Record<EmailKind, EmailText> };

const COMMON = ['voornaam', 'naam'];
export const KIND_INFO: Record<EmailKind, { label: string; when: string; placeholders: string[] }> = {
  orderConfirmation: {
    label: 'Bevestiging van bestelling',
    when: 'Direct na een geslaagde betaling.',
    placeholders: [...COMMON, 'bestelnummer', 'totaal'],
  },
  orderShipped: {
    label: 'Bestelling verzonden',
    when: 'Als je een bestelling op ‘verzonden’ zet.',
    placeholders: [...COMMON, 'bestelnummer', 'vervoerder', 'trackcode'],
  },
  orderReady: {
    label: 'Klaar om af te halen',
    when: 'Als je een afhaalbestelling klaarzet.',
    placeholders: [...COMMON, 'bestelnummer', 'afhaaladres'],
  },
  bookingReceived: {
    label: 'Afspraakaanvraag ontvangen',
    when: 'Direct na een aanvraag via het afspraakformulier.',
    placeholders: [...COMMON, 'dienst', 'auto', 'voorkeursdatum'],
  },
};

export const EMAIL: EmailSettings = {
  design: {
    template: 'klassiek',
    accent: '#d9a72a',
    rounded: false,
    headerImage: 'coatings-level-2',
    footerText: 'Car detailing in Enschede en omstreken',
    showSocial: true,
  },
  texts: {
    orderConfirmation: {
      subject: 'Bedankt voor je bestelling {bestelnummer}',
      preheader: 'We hebben je betaling ontvangen en gaan aan de slag.',
      heading: 'Bedankt, {voornaam}!',
      intro: 'We hebben je betaling ontvangen en gaan direct aan de slag met je bestelling. Hieronder vind je alles nog even op een rij.',
      button: 'Bekijk je bestelling',
      closing: 'Vragen over je bestelling? Beantwoord gewoon deze mail of bel ons, we helpen je graag.',
    },
    orderShipped: {
      subject: 'Je bestelling {bestelnummer} is onderweg',
      preheader: 'Je pakket is aan {vervoerder} meegegeven.',
      heading: 'Je pakket is onderweg',
      intro: 'Goed nieuws, {voornaam}: we hebben je bestelling ingepakt en aan {vervoerder} meegegeven. Meestal wordt het pakket de volgende werkdag bezorgd.',
      button: 'Volg je pakket',
      closing: 'Veel plezier met je producten! Tip: was je auto met de hand voor het beste resultaat.',
    },
    orderReady: {
      subject: 'Je bestelling {bestelnummer} ligt klaar',
      preheader: 'Je kunt je bestelling ophalen.',
      heading: 'Je bestelling ligt klaar',
      intro: 'Hoi {voornaam}, je bestelling ligt voor je klaar. Neem je bestelnummer mee als je langskomt.',
      button: 'Bekijk je bestelling',
      closing: 'Tot snel!',
    },
    bookingReceived: {
      subject: 'We hebben je aanvraag ontvangen',
      preheader: 'We nemen binnen één werkdag contact met je op.',
      heading: 'Bedankt voor je aanvraag, {voornaam}',
      intro: 'We hebben je aanvraag voor {dienst} goed ontvangen. We bekijken hem en nemen binnen één werkdag contact met je op om de datum en de prijs te bevestigen.',
      button: 'Bekijk onze diensten',
      closing: 'Heb je nog foto’s van de auto of extra wensen? Stuur ze gerust als antwoord op deze mail.',
    },
  },
};

/** Replaces {placeholders}; unknown ones are left as typed so mistakes stay visible in the preview. */
export function fillPlaceholders(text: string, values: Record<string, string>) {
  return text.replace(/\{([a-z]+)\}/g, (match, key: string) => (key in values ? values[key] : match));
}
