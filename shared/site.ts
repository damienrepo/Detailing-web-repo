// Business details used across the site, legal pages, emails and structured data.
// Values marked TODO are placeholders and must be replaced before going live.

export const SITE = {
  name: 'Lumen',
  fullName: 'Lumen Detailing',
  legalName: 'Lumen Detailing', // TODO: officiële naam zoals ingeschreven bij de KvK
  tagline: 'Detailing studio & interieurverzorging',
  description:
    'Detailing studio in Nederland voor lakcorrectie, keramische coatings en interieurreiniging. Bestel ook onze eigen interieurproducten online.',
  address: {
    street: 'Automotive Boulevard 12', // TODO
    postalCode: '1000 AA', // TODO
    city: 'Amsterdam', // TODO
    country: 'Nederland',
  },
  phone: '+31 20 123 4567', // TODO
  phoneHref: '+31201234567', // TODO
  email: 'info@lumendetailing.nl', // TODO
  kvk: '00000000', // TODO: KvK-nummer
  vatNumber: 'NL000000000B01', // TODO: btw-identificatienummer
  hours: [
    { days: 'Maandag – vrijdag', time: '08:30 – 18:00' },
    { days: 'Zaterdag', time: '09:00 – 15:00' },
    { days: 'Zondag', time: 'Gesloten' },
  ],
  social: {
    instagram: 'https://www.instagram.com/', // TODO
    facebook: 'https://www.facebook.com/', // TODO
  },
  /** Working days between payment and handing the parcel to the carrier. */
  dispatchDays: '1–2 werkdagen',
  carrier: 'PostNL',
  returnDays: 14,
} as const;
