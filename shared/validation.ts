// Form validation shared by the server and the in-browser demo build.
import { z } from 'zod';
import { COUNTRIES } from './pricing';
import { SERVICES } from './services';

const postalCodes = { NL: /^[1-9]\d{3}\s?[A-Za-z]{2}$/, BE: /^[1-9]\d{3}$/ } as const;

const REQUIRED = 'Vul dit veld in';
const trimmed = (max: number) =>
  z
    .string({ error: REQUIRED })
    .trim()
    .min(1, REQUIRED)
    .max(max, `Maximaal ${max} tekens`);
const email = z.email({ error: 'Vul een geldig e-mailadres in' }).max(200);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Maximaal ${max} tekens`)
    .optional()
    .transform((v) => v || undefined);

export const checkoutSchema = z
  .object({
    items: z
      .array(z.object({ productId: z.string().max(50), quantity: z.number().int().min(1).max(20) }))
      .min(1)
      .max(10),
    customer: z.object({
      email,
      name: trimmed(100),
      phone: optionalText(30),
      street: trimmed(100),
      houseNumber: trimmed(15),
      postalCode: trimmed(10).regex(/^\d{4}\s?[A-Za-z]{0,2}$/, 'Vul een geldige postcode in'),
      city: trimmed(80),
      country: z.enum(COUNTRIES as ['NL', 'BE']),
      notes: optionalText(500),
    }),
    acceptTerms: z.literal(true, { error: 'Ga akkoord met de algemene voorwaarden' }),
  })
  .refine((v) => postalCodes[v.customer.country].test(v.customer.postalCode), {
    path: ['customer', 'postalCode'],
    message: 'Deze postcode past niet bij het gekozen land',
  });

export const bookingSchema = z.object({
  serviceId: z.enum(SERVICES.map((s) => s.id) as [string, ...string[]], { error: 'Kies een behandeling' }),
  vehicle: trimmed(100),
  preferredDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Kies een geldige datum')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  name: trimmed(100),
  email,
  phone: trimmed(30),
  postalCode: optionalText(10),
  message: optionalText(1000),
  /** Honeypot: real visitors never fill this hidden field. */
  website: z.string().max(0).optional(),
});

export const shipSchema = z.object({ trackingCode: optionalText(60) });
export const bookingStatusSchema = z.object({ status: z.enum(['new', 'confirmed', 'done', 'cancelled']) });

export function fieldErrors(error: z.ZodError) {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.filter((p) => p !== 'customer').join('.');
    if (key && !fields[key]) fields[key] = issue.message;
  }
  return fields;
}
