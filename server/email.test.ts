import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { EMAIL } from '../shared/email';
import { sampleMail } from './emails';
import { setup, signedIn } from './testUtils';

const customer = { email: 'klant@example.com', name: '<b>Sanne</b> de Vries', country: 'NL', street: 'Kerkstraat', houseNumber: '1', postalCode: '7511AB', city: 'Enschede' };

describe('e-mails', () => {
  it('are sent as responsive HTML with a plain-text version, with customer data escaped', async () => {
    const ctx = setup();
    const { body } = await request(ctx.app)
      .post('/api/orders')
      .send({ items: [{ productId: 'microfiber-towel', quantity: 1 }], customer, acceptTerms: true });
    ctx.payments.settle(body.checkoutUrl.split('/').pop(), 'paid');
    await request(ctx.app).get(`/api/orders/${body.orderId}`);

    const mail = ctx.sent.find((m) => m.to === 'klant@example.com')!;
    expect(mail.subject).toBe('Bedankt voor je bestelling D2G-1001');
    expect(mail.html).toContain('@media (max-width:620px)');
    expect(mail.html).toContain('&lt;b&gt;Sanne&lt;/b&gt;');
    expect(mail.html).not.toContain('<b>Sanne</b>');
    expect(mail.text).toContain('Bedankt, <b>Sanne</b>!');
  });

  it('use the texts and design saved in the admin', async () => {
    const ctx = setup();
    const client = await signedIn(ctx);
    const { body } = await client.get('/api/admin/email').expect(200);
    const settings = {
      ...body.settings,
      design: { ...body.settings.design, template: 'licht', accent: '#1f4e8c' },
      texts: { ...body.settings.texts, bookingReceived: { ...body.settings.texts.bookingReceived, subject: 'Top {voornaam}, we bellen je!' } },
    };
    await client.put('/api/admin/content/email').send({ ...settings, design: { ...settings.design, accent: 'blauw' } }).expect(400);
    await client.put('/api/admin/content/email').send(settings).expect(200);

    await request(ctx.app)
      .post('/api/bookings')
      .send({ serviceId: 'coatings', vehicle: 'Golf', name: 'Jan Jansen', email: 'jan@example.com', phone: '0612345678', website: '' })
      .expect(201);
    const mail = ctx.sent.find((m) => m.to === 'jan@example.com')!;
    expect(mail.subject).toBe('Top Jan, we bellen je!');
    expect(mail.html).toContain('#1f4e8c');

    // E-mail settings are never sent to visitors with the page content.
    expect((await client.get('/api/admin/content')).body.embed).not.toContain('bellen je');
    await client.delete('/api/admin/content/email').expect(200);
    expect(EMAIL.texts.bookingReceived.subject).toBe('We hebben je aanvraag ontvangen');
  });

  it('can be previewed in the admin, and only test-sent when SMTP is set up', async () => {
    const ctx = setup();
    const client = await signedIn(ctx);
    const { body } = await client.get('/api/admin/email');
    const preview = await client.post('/api/admin/email/preview').send({ settings: body.settings, kind: 'orderShipped' }).expect(200);
    expect(preview.body.subject).toBe('Je bestelling D2G-1042 is onderweg');
    expect(preview.body.html).toContain('3SDETAIL2GO42');
    await client.post('/api/admin/email/preview').send({ settings: { ...body.settings, design: {} }, kind: 'orderShipped' }).expect(400);
    const test = await client.post('/api/admin/email/test').send({ settings: body.settings, kind: 'orderShipped' }).expect(400);
    expect(test.body.error).toMatch(/Stel eerst de e-mail in/);
  });

  it('render every template and mail without leftover placeholders', () => {
    for (const template of ['klassiek', 'licht', 'foto'] as const) {
      for (const kind of ['orderConfirmation', 'orderShipped', 'orderReady', 'bookingReceived'] as const) {
        const mail = sampleMail(kind, { ...EMAIL, design: { ...EMAIL.design, template } }, 'https://detail2go.nl', 'a@b.nl');
        expect(mail.html).not.toMatch(/\{[a-z]+\}/);
        expect(mail.subject).not.toMatch(/\{[a-z]+\}/);
      }
    }
  });
});
