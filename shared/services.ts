// Studio services shown on the homepage and in the booking form.
// TODO: check prices, durations and what is included with the actual offer.

export type Service = {
  id: string;
  name: string;
  summary: string;
  fromPrice: number; // euro cents
  duration: string;
  includes: string[];
  image: string;
};

export const SERVICES: Service[] = [
  {
    id: 'interieur',
    name: 'Interieur detailing',
    summary: 'Dieptereiniging van bekleding, kunststof en leer. Geurneutralisatie en een fris, mat resultaat.',
    fromPrice: 14900,
    duration: '3 – 5 uur',
    includes: ['Stofzuigen incl. kofferbak', 'Bekleding en matten extraheren', 'Kunststof en leer reinigen', 'Ramen binnenzijde'],
    image: 'https://images.unsplash.com/photo-1605515298946-d062f2e9da53?q=80&w=1600&auto=format&fit=crop',
  },
  {
    id: 'lakcorrectie',
    name: 'Lakcorrectie',
    summary: 'Machinaal polijsten in één of meer stappen om swirls, krassen en hologrammen te verwijderen.',
    fromPrice: 29900,
    duration: '1 – 3 dagen',
    includes: ['Handwas en decontaminatie', 'Laklaagdiktemeting', 'Polijsten in 1 tot 3 stappen', 'Inspectie onder studiolicht'],
    image: 'https://images.unsplash.com/photo-1601362840469-51e4d8d58785?q=80&w=1600&auto=format&fit=crop',
  },
  {
    id: 'coating',
    name: 'Keramische coating',
    summary: 'Langdurige bescherming tegen vuil, UV en weersinvloeden. Waterafstotend en makkelijk te onderhouden.',
    fromPrice: 49900,
    duration: '2 – 3 dagen',
    includes: ['Volledige lakvoorbereiding', 'Eénstaps polijstbehandeling', 'Coating op lak, velgen en glas', 'Onderhoudsadvies'],
    image: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?q=80&w=1600&auto=format&fit=crop',
  },
];

export function getService(id: string): Service | undefined {
  return SERVICES.find((s) => s.id === id);
}
