import { formatPrice, SHIPPING } from '../shared/pricing';
import { SITE } from '../shared/site';
import { getService } from '../shared/services';
import type { Mail } from './mail';
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

const signature = `\n\nMet vriendelijke groet,\n${SITE.fullName}\n${SITE.phone} · ${SITE.email}`;

function orderLines(order: Order) {
  const lines = order.items.map((i) => `${i.quantity} × ${i.name}  ${formatPrice(i.line_total)}`);
  lines.push(`Verzending  ${order.shipping === 0 ? 'gratis' : formatPrice(order.shipping)}`);
  lines.push(`Totaal  ${formatPrice(order.total)} (incl. ${formatPrice(order.vat)} btw)`);
  return lines.join('\n');
}

function address(order: Order) {
  return `${order.name}\n${order.street} ${order.house_number}\n${order.postal_code} ${order.city}\n${SHIPPING[order.country].label}`;
}

export function orderConfirmationMail(order: Order, orderUrl: string): Mail {
  return {
    to: order.email,
    subject: `Bevestiging van je bestelling ${order.number}`,
    text:
      `Hoi ${order.name},\n\nBedankt voor je bestelling. We hebben je betaling ontvangen en pakken je bestelling in. ` +
      `We versturen binnen ${SITE.dispatchDays} met ${SITE.carrier}; je ontvangt een track-and-trace code zodra het pakket onderweg is.\n\n` +
      `Bestelling ${order.number}\n${orderLines(order)}\n\nBezorgadres\n${address(order)}\n\n` +
      `Je bestelling bekijken: ${orderUrl}\n\n` +
      `Je hebt ${SITE.returnDays} dagen bedenktijd na ontvangst. Meer informatie: ${orderUrl.replace(/\/bestelling\/.*/, '/retourneren')}` +
      signature,
  };
}

export function orderNotificationMail(order: Order, to: string): Mail {
  return {
    to,
    replyTo: order.email,
    subject: `Nieuwe bestelling ${order.number} — ${formatPrice(order.total)}`,
    text:
      `Nieuwe betaalde bestelling ${order.number}.\n\n${orderLines(order)}\n\n` +
      `Verzenden naar\n${address(order)}\n\nE-mail: ${order.email}\nTelefoon: ${order.phone ?? '-'}\nOpmerking: ${order.notes ?? '-'}`,
  };
}

export function orderShippedMail(order: Order, orderUrl: string): Mail {
  const tracking = order.tracking_code
    ? `Je track-and-trace code: ${order.tracking_code}\nVolgen: https://jouw.postnl.nl/track-and-trace/${encodeURIComponent(order.tracking_code)}-${order.country}-${order.postal_code.replace(/\s/g, '')}\n\n`
    : '';
  return {
    to: order.email,
    subject: `Je bestelling ${order.number} is onderweg`,
    text: `Hoi ${order.name},\n\nGoed nieuws: je bestelling ${order.number} is verzonden.\n\n${tracking}Je bestelling bekijken: ${orderUrl}${signature}`,
  };
}

export function bookingReceivedMail(booking: BookingInput): Mail {
  const service = getService(booking.serviceId);
  return {
    to: booking.email,
    subject: `We hebben je aanvraag ontvangen — ${service?.name ?? 'afspraak'}`,
    text:
      `Hoi ${booking.name},\n\nBedankt voor je aanvraag voor ${service?.name.toLowerCase() ?? 'een behandeling'} ` +
      `voor je ${booking.vehicle}. We nemen binnen één werkdag contact met je op om de afspraak en de prijs te bevestigen.` +
      (booking.preferredDate ? `\n\nVoorkeursdatum: ${booking.preferredDate}` : '') +
      signature,
  };
}

export function bookingNotificationMail(booking: BookingInput, to: string): Mail {
  const service = getService(booking.serviceId);
  return {
    to,
    replyTo: booking.email,
    subject: `Nieuwe afspraakaanvraag: ${service?.name ?? booking.serviceId} — ${booking.vehicle}`,
    text: [
      `Dienst: ${service?.name ?? booking.serviceId}`,
      `Auto: ${booking.vehicle}`,
      `Voorkeursdatum: ${booking.preferredDate || '-'}`,
      `Naam: ${booking.name}`,
      `E-mail: ${booking.email}`,
      `Telefoon: ${booking.phone}`,
      `Postcode: ${booking.postalCode || '-'}`,
      `Bericht: ${booking.message || '-'}`,
    ].join('\n'),
  };
}
