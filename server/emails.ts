// All e-mails the shop sends. Texts and design come from the admin (E-mails), see shared/email.ts.
import { EMAIL, fillPlaceholders, type EmailKind, type EmailSettings } from '../shared/email';
import { formatPrice, PICKUP, pickupLocation, SHIPPING } from '../shared/pricing';
import { findService, nameInSentence } from '../shared/services';
import { SITE } from '../shared/site';
import type { Mail } from './mail';
import { renderEmail, type EmailBlock, type EmailContent } from './mailTemplates';
import type { Order } from './orders';

export type BookingInput = {
  serviceId: string;
  vehicle: string;
  preferredDate?: string;
  name: string;
  email: string;
  phone: string;
  postalCode?: string;
  message?: string;
};

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;
const originOf = (url: string) => new URL(url).origin;

export function trackingUrl(order: Pick<Order, 'tracking_code' | 'country' | 'postal_code'>) {
  if (!order.tracking_code) return undefined;
  return `https://jouw.postnl.nl/track-and-trace/${encodeURIComponent(order.tracking_code)}-${order.country}-${order.postal_code.replace(/\s/g, '')}`;
}

function summary(order: Order): EmailBlock {
  const pickup = order.shipping_method === 'pickup';
  return {
    type: 'summary',
    title: `Bestelling ${order.number}`,
    items: order.items.map((i) => ({ label: `${i.quantity} × ${i.name}`, value: formatPrice(i.line_total) })),
    totals: [
      { label: 'Subtotaal', value: formatPrice(order.subtotal) },
      { label: pickup ? 'Afhalen' : 'Verzending', value: order.shipping === 0 ? 'Gratis' : formatPrice(order.shipping) },
      { label: 'Totaal', value: formatPrice(order.total), strong: true },
      { label: 'Waarvan btw', value: formatPrice(order.vat), muted: true },
    ],
  };
}

function deliveryBlock(order: Order): EmailBlock {
  if (order.shipping_method === 'pickup') {
    return { type: 'box', title: 'Afhalen', lines: [pickupLocation(), PICKUP.readyTime && `${PICKUP.readyTime}. We mailen je zodra het klaarligt.`, PICKUP.instructions].filter(Boolean) };
  }
  return {
    type: 'box',
    title: 'Bezorgadres',
    lines: [
      `${order.name}\n${order.street} ${order.house_number}\n${order.postal_code} ${order.city}\n${SHIPPING[order.country].label}`,
      `We versturen binnen ${SITE.dispatchDays} met ${SITE.carrier}. Je krijgt een track-and-trace code zodra je pakket onderweg is.`,
    ],
  };
}

/** Builds a mail from the admin texts for `kind`, filling in the placeholders. */
function fromTemplate(
  kind: EmailKind,
  settings: EmailSettings,
  values: Record<string, string>,
  parts: { buttonUrl?: string; blocks: EmailBlock[]; note: string },
): Pick<EmailContent, 'subject' | 'preheader' | 'heading' | 'intro' | 'closing' | 'button' | 'blocks' | 'note'> {
  const t = settings.texts[kind];
  const fill = (s: string) => fillPlaceholders(s, values);
  return {
    subject: fill(t.subject),
    preheader: fill(t.preheader),
    heading: fill(t.heading),
    intro: fill(t.intro),
    closing: fill(t.closing),
    button: parts.buttonUrl && t.button ? { label: fill(t.button), url: parts.buttonUrl } : undefined,
    blocks: parts.blocks,
    note: parts.note,
  };
}

function finish(to: string, content: EmailContent, settings: EmailSettings, appUrl: string, replyTo?: string): Mail {
  const { html, text } = renderEmail(content, settings.design, appUrl);
  return { to, subject: content.subject, text, html, ...(replyTo ? { replyTo } : {}) };
}

const orderValues = (order: Order) => ({
  naam: order.name,
  voornaam: firstName(order.name),
  bestelnummer: order.number,
  totaal: formatPrice(order.total),
  vervoerder: SITE.carrier,
  trackcode: order.tracking_code ?? '',
  afhaaladres: pickupLocation(),
});

export function orderConfirmationMail(order: Order, orderUrl: string, settings: EmailSettings = EMAIL): Mail {
  const content = fromTemplate('orderConfirmation', settings, orderValues(order), {
    buttonUrl: orderUrl,
    blocks: [summary(order), deliveryBlock(order)],
    note: `Je ontvangt deze e-mail omdat je een bestelling plaatste bij ${SITE.fullName}. Je hebt ${SITE.returnDays} dagen bedenktijd na ontvangst.`,
  });
  return finish(order.email, content, settings, originOf(orderUrl));
}

export function orderShippedMail(order: Order, orderUrl: string, settings: EmailSettings = EMAIL): Mail {
  const track = trackingUrl(order);
  const blocks: EmailBlock[] = [];
  if (order.tracking_code) blocks.push({ type: 'code', label: 'Track-and-trace code', value: order.tracking_code });
  blocks.push(summary(order));
  const content = fromTemplate('orderShipped', settings, orderValues(order), {
    buttonUrl: track ?? orderUrl,
    blocks,
    note: `Je ontvangt deze e-mail over je bestelling ${order.number} bij ${SITE.fullName}.`,
  });
  return finish(order.email, content, settings, originOf(orderUrl));
}

export function orderReadyMail(order: Order, orderUrl: string, settings: EmailSettings = EMAIL): Mail {
  const content = fromTemplate('orderReady', settings, orderValues(order), {
    buttonUrl: orderUrl,
    blocks: [
      { type: 'box', title: 'Afhaaladres', lines: [pickupLocation(), PICKUP.instructions].filter(Boolean) },
      { type: 'code', label: 'Je bestelnummer', value: order.number },
      summary(order),
    ],
    note: `Je ontvangt deze e-mail over je bestelling ${order.number} bij ${SITE.fullName}.`,
  });
  return finish(order.email, content, settings, originOf(orderUrl));
}

function formatDate(iso?: string) {
  if (!iso) return 'Geen voorkeur';
  return new Date(`${iso}T12:00:00`).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function bookingReceivedMail(booking: BookingInput, appUrl: string, settings: EmailSettings = EMAIL): Mail {
  const service = findService(booking.serviceId);
  const content = fromTemplate(
    'bookingReceived',
    settings,
    {
      naam: booking.name,
      voornaam: firstName(booking.name),
      dienst: service ? nameInSentence(service) : 'een behandeling',
      auto: booking.vehicle,
      voorkeursdatum: formatDate(booking.preferredDate),
    },
    {
      buttonUrl: `${appUrl}/diensten`,
      blocks: [
        {
          type: 'details',
          title: 'Je aanvraag',
          rows: [
            ['Behandeling', service?.name ?? booking.serviceId],
            ['Auto', booking.vehicle],
            ['Voorkeursdatum', formatDate(booking.preferredDate)],
            ...(booking.message ? ([['Toelichting', booking.message]] as [string, string][]) : []),
          ],
        },
      ],
      note: `Je ontvangt deze e-mail omdat je een afspraak aanvroeg bij ${SITE.fullName}. Een aanvraag is vrijblijvend.`,
    },
  );
  return finish(booking.email, content, settings, appUrl);
}

// --- Notifications for the shop (fixed texts) -------------------------------------------

export function orderNotificationMail(order: Order, to: string, appUrl = '', settings: EmailSettings = EMAIL): Mail {
  const pickup = order.shipping_method === 'pickup';
  const content: EmailContent = {
    subject: `Nieuwe bestelling ${order.number} — ${formatPrice(order.total)}${pickup ? ' (afhalen)' : ''}`,
    preheader: `${order.name} · ${formatPrice(order.total)}`,
    heading: pickup ? 'Nieuwe bestelling: AFHALEN' : 'Nieuwe bestelling',
    intro: pickup
      ? `${order.name} komt de bestelling ophalen. Zet hem klaar en markeer hem in het beheer als ‘Klaar om af te halen’; de klant krijgt dan automatisch een mail.`
      : `${order.name} heeft betaald. Verstuur de bestelling en markeer hem in het beheer als verzonden.`,
    button: appUrl ? { label: 'Open het beheer', url: `${appUrl}/admin/bestellingen` } : undefined,
    blocks: [
      summary(order),
      pickup
        ? { type: 'box', title: 'Afhalen', lines: [`AFHALEN door ${order.name}`] }
        : { type: 'box', title: 'Verzenden naar', lines: [`${order.name}\n${order.street} ${order.house_number}\n${order.postal_code} ${order.city}\n${SHIPPING[order.country].label}`] },
      { type: 'details', title: 'Klant', rows: [['E-mail', order.email], ['Telefoon', order.phone ?? '-'], ['Opmerking', order.notes ?? '-']] },
    ],
  };
  return finish(to, content, settings, appUrl || 'http://localhost', order.email);
}

export function bookingNotificationMail(booking: BookingInput, to: string, appUrl = '', settings: EmailSettings = EMAIL): Mail {
  const service = findService(booking.serviceId);
  const content: EmailContent = {
    subject: `Nieuwe afspraakaanvraag: ${service?.name ?? booking.serviceId} — ${booking.vehicle}`,
    preheader: `${booking.name} · ${booking.phone}`,
    heading: 'Nieuwe afspraakaanvraag',
    intro: `${booking.name} wil graag een afspraak. Neem binnen één werkdag contact op.`,
    button: appUrl ? { label: 'Open het beheer', url: `${appUrl}/admin/afspraken` } : undefined,
    blocks: [
      {
        type: 'details',
        rows: [
          ['Dienst', service?.name ?? booking.serviceId],
          ['Auto', booking.vehicle],
          ['Voorkeursdatum', booking.preferredDate || '-'],
          ['Naam', booking.name],
          ['E-mail', booking.email],
          ['Telefoon', booking.phone],
          ['Postcode', booking.postalCode || '-'],
          ['Bericht', booking.message || '-'],
        ],
      },
    ],
  };
  return finish(to, content, settings, appUrl || 'http://localhost', booking.email);
}

// --- Preview data for the mail designer --------------------------------------------------

/** A realistic example of each customer mail, for the preview and the test mail in the admin. */
export function sampleMail(kind: EmailKind, settings: EmailSettings, appUrl: string, to: string): Mail {
  const base: Order = {
    id: 42,
    public_id: 'voorbeeld',
    number: 'D2G-1042',
    status: 'paid',
    shipping_method: kind === 'orderReady' ? 'pickup' : 'delivery',
    email: to,
    name: 'Sanne de Vries',
    phone: '06 12 34 56 78',
    street: 'Kerkstraat',
    house_number: '12a',
    postal_code: '7511 AB',
    city: 'Enschede',
    country: 'NL',
    notes: null,
    subtotal: 3790,
    shipping: kind === 'orderReady' ? 0 : 495,
    vat: 0,
    total: 0,
    payment_id: null,
    payment_method: 'ideal',
    tracking_code: kind === 'orderShipped' ? '3SDETAIL2GO42' : null,
    created_at: '',
    paid_at: null,
    shipped_at: null,
    ready_at: null,
    collected_at: null,
    items: [
      { product_id: 'interior-kit', sku: 'D2G-KIT-01', name: 'Interior Care Kit', unit_price: 2995, quantity: 1, line_total: 2995 },
      { product_id: 'microfiber-towel', sku: 'D2G-MF-40', name: 'Microvezel doek', unit_price: 795, quantity: 1, line_total: 795 },
    ],
  };
  base.total = base.subtotal + base.shipping;
  base.vat = base.total - Math.round(base.total / 1.21);
  const orderUrl = `${appUrl}/bestelling/voorbeeld`;
  if (kind === 'orderConfirmation') return orderConfirmationMail(base, orderUrl, settings);
  if (kind === 'orderShipped') return orderShippedMail(base, orderUrl, settings);
  if (kind === 'orderReady') return orderReadyMail(base, orderUrl, settings);
  return bookingReceivedMail(
    { serviceId: 'coatings', vehicle: 'Porsche Cayman, 2019', preferredDate: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10), name: 'Sanne de Vries', email: to, phone: '06 12 34 56 78', message: 'Graag ook de velgen meenemen.' },
    appUrl,
    settings,
  );
}
