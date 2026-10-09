// Business details used across the site, legal pages, emails and structured data.
// Values marked TODO are placeholders and must be replaced before going live.

export type SiteInfo = {
  name: string;
  fullName: string;
  legalName: string;
  tagline: string;
  description: string;
  region: string;
  address: { street: string; postalCode: string; city: string; country: string };
  phone: string;
  phoneHref: string;
  whatsapp: string;
  email: string;
  kvk: string;
  vatNumber: string;
  hours: { days: string; time: string }[];
  social: { instagram: string; tiktok: string };
  dispatchDays: string;
  carrier: string;
  returnDays: number;
};

/** Editable in the admin (Bedrijfsgegevens); these are the defaults. */
export const SITE: SiteInfo = {
  name: 'Detail2Go',
  fullName: 'Detail2Go',
  legalName: 'Detail2Go', // TODO: officiële naam zoals ingeschreven bij de KvK
  tagline: 'Car detailing in Enschede en omstreken',
  description:
    'Car detailing in Enschede en omstreken: luxe handwas, interieurreiniging, polijsten, glascoating, PPF en schadeherstel. Bij jou op locatie of in onze werkplaats.',
  /** Area we drive to for on-location work. */
  region: 'Enschede en omstreken',
  address: {
    street: '', // TODO: adres van de werkplaats (in te vullen in het beheer)
    postalCode: '',
    city: 'Enschede',
    country: 'Nederland',
  },
  phone: '06 22 76 75 54',
  phoneHref: '+31622767554',
  /** Same number, for WhatsApp links. */
  whatsapp: 'https://wa.me/31622767554',
  email: 'contact@detail2go.nl',
  kvk: '00000000', // TODO: KvK-nummer
  vatNumber: 'NL000000000B01', // TODO: btw-identificatienummer
  hours: [ // TODO: echte openingstijden
    { days: 'Maandag – vrijdag', time: '08:30 – 18:00' },
    { days: 'Zaterdag', time: '09:00 – 15:00' },
    { days: 'Zondag', time: 'Gesloten' },
  ],
  social: {
    instagram: 'https://www.instagram.com/detail2go_/',
    tiktok: 'https://www.tiktok.com/@detail2go',
  },
  /** Working days between payment and handing the parcel to the carrier. */
  dispatchDays: '1–2 werkdagen',
  carrier: 'PostNL',
  returnDays: 14,
};

/** "Straat 1, 7511 AB Enschede", or just the city when no street is set. */
export function formatAddress(site: SiteInfo = SITE): string {
  return [site.address.street, [site.address.postalCode, site.address.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}

/** "06 22 76 75 54" → "+31622767554", for tel: links. */
export function phoneToHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  if (digits.startsWith('0')) return `+31${digits.slice(1)}`;
  return `+${digits}`;
}
