// Validation for the Estadio bookings and the admin (server side and admin only, so the booking page stays small).
import { z } from 'zod';

const REQUIRED = 'Vul dit veld in';
const text = (max: number) => z.string().trim().max(max, `Maximaal ${max} tekens`).default('');
const required = (max: number) => z.string({ error: REQUIRED }).trim().min(1, REQUIRED).max(max, `Maximaal ${max} tekens`);

/** Dutch and foreign number plates: letters, digits and dashes, stored in capitals. */
export const plateSchema = z
  .string({ error: 'Vul je kenteken in' })
  .trim()
  .transform((v) => v.toUpperCase().replace(/\s+/g, '-'))
  .refine((v) => /^[A-Z0-9-]{4,12}$/.test(v) && /[A-Z0-9]{4,}/.test(v.replace(/-/g, '')), 'Vul een geldig kenteken in, bijv. AB-123-C');

const customerFields = {
  name: required(100),
  email: z.email({ error: 'Vul een geldig e-mailadres in' }).max(200),
  phone: required(30).refine((v) => v.replace(/\D/g, '').length >= 8, 'Vul een geldig telefoonnummer in'),
  company: text(100),
  plate: plateSchema,
  vehicle: text(80),
  parking: text(120),
  notes: text(600),
};

const slotFields = {
  packageId: z.string().min(1, 'Kies een pakket').max(40),
  dayId: z.number({ error: 'Kies een dag' }).int().positive(),
  start: z.number({ error: 'Kies een tijd' }).int().min(0).max(1439),
};

export const bookingRequestSchema = z.object({
  ...slotFields,
  ...customerFields,
  /** Honeypot: real visitors never fill this hidden field. */
  website: z.string().max(0).optional(),
});
export type EstadioBookingRequest = z.infer<typeof bookingRequestSchema>;

export const rescheduleSchema = z.object(slotFields);

/** A booking added by the admin (e.g. after a phone call); e-mail is optional there. */
export const adminBookingSchema = z.object({
  ...slotFields,
  ...customerFields,
  email: z.union([z.literal(''), z.email({ error: 'Vul een geldig e-mailadres in' }).max(200)]).default(''),
  phone: text(30),
  /** Skip the capacity check, for squeezing a car in. */
  force: z.boolean().default(false),
});

const timeSchema = z.number().int().min(0).max(1440);

export const daySchema = z
  .object({
    start: timeSchema,
    end: timeSchema,
    capacity: z.number().int().min(1, 'Minimaal 1').max(10, 'Maximaal 10'),
    interval: z.number().int().min(5, 'Minimaal 5 minuten').max(240),
    breakStart: timeSchema.nullable().default(null),
    breakEnd: timeSchema.nullable().default(null),
    open: z.boolean().default(true),
    note: text(300),
  })
  .superRefine((d, ctx) => {
    if (d.end - d.start < 30) ctx.addIssue({ code: 'custom', path: ['end'], message: 'De eindtijd moet minstens een half uur na de begintijd liggen' });
    if ((d.breakStart == null) !== (d.breakEnd == null)) ctx.addIssue({ code: 'custom', path: ['breakEnd'], message: 'Vul het begin én het eind van de pauze in' });
    if (d.breakStart != null && d.breakEnd != null && (d.breakEnd <= d.breakStart || d.breakStart < d.start || d.breakEnd > d.end)) {
      ctx.addIssue({ code: 'custom', path: ['breakStart'], message: 'De pauze moet binnen de werktijden vallen' });
    }
  });

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Kies een geldige datum');
export const newDaysSchema = z.object({ dates: z.array(isoDate).min(1, 'Kies minstens één datum').max(24), day: daySchema });

export const packageSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,40}$/, 'Alleen kleine letters, cijfers en streepjes'),
  name: required(60),
  scope: text(60),
  price: z.number({ error: 'Vul een prijs in' }).int().min(0).max(1_000_000),
  duration: z.number({ error: 'Vul een duur in' }).int().min(15, 'Minimaal 15 minuten').max(600, 'Maximaal 10 uur'),
  intro: text(400),
  groups: z
    .array(z.object({ title: text(60), items: z.array(required(160)).max(12) }))
    .max(6),
  badge: text(30),
  visible: z.boolean(),
});

export const packagesSchema = z
  .array(packageSchema)
  .min(1, 'Er moet minstens één pakket zijn')
  .max(8)
  .refine((list) => new Set(list.map((p) => p.id)).size === list.length, 'Twee pakketten hebben dezelfde code');

export const settingsSchema = z.object({
  enabled: z.boolean(),
  headline: required(120),
  intro: text(600),
  locationName: required(80),
  address: required(120),
  practical: z.array(required(300)).max(8),
  paymentNote: text(200),
  cancelHours: z.number().int().min(0).max(14 * 24),
  closeHours: z.number().int().min(0).max(7 * 24),
  reminders: z.boolean(),
});
