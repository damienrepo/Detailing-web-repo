import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { ADMIN, adminClient, setup, signedIn } from './testUtils';

describe('admins (e.g. a business partner)', () => {
  it('adds an admin who can sign in with the temporary password, only with your own password', async () => {
    const ctx = setup();
    const client = await signedIn(ctx);
    const partner = { name: 'Stein Veldman', email: 'Stein@Example.com' };

    await client.post('/api/admin/admins').send({ ...partner, password: 'fout-wachtwoord' }).expect(400);
    const res = await client.post('/api/admin/admins').send({ ...partner, password: ADMIN.password }).expect(201);
    expect(res.body.user).toMatchObject({ name: 'Stein Veldman', email: 'stein@example.com', totpEnabled: false });
    expect(res.body.password).toMatch(/^[A-Za-z2-9]{5}(-[A-Za-z2-9]{5}){3}$/);
    await client.post('/api/admin/admins').send({ ...partner, password: ADMIN.password }).expect(400); // same e-mail

    const list = (await client.get('/api/admin/admins').expect(200)).body;
    expect(list.map((a: { email: string; isYou: boolean }) => [a.email, a.isYou])).toEqual([[ADMIN.email, true], ['stein@example.com', false]]);
    expect(JSON.stringify(list)).not.toContain('password_hash');

    const stein = adminClient(request.agent(ctx.app));
    await stein.post('/api/admin/login').send({ email: 'stein@example.com', password: res.body.password }).expect(200);
    expect((await stein.get('/api/admin/session')).body).toMatchObject({ state: 'ok', user: { name: 'Stein Veldman' } });
  });

  it('removes another admin and signs them out, but never yourself', async () => {
    const ctx = setup();
    const client = await signedIn(ctx);
    const { body } = await client.post('/api/admin/admins').send({ name: 'Stein', email: 'stein@example.com', password: ADMIN.password }).expect(201);
    const stein = adminClient(request.agent(ctx.app));
    await stein.post('/api/admin/login').send({ email: 'stein@example.com', password: body.password }).expect(200);

    const me = (await client.get('/api/admin/admins')).body.find((a: { isYou: boolean }) => a.isYou);
    await client.post(`/api/admin/admins/${me.id}/remove`).send({ password: ADMIN.password }).expect(400);
    await client.post(`/api/admin/admins/${body.user.id}/remove`).send({ password: 'fout' }).expect(400);
    await client.post(`/api/admin/admins/${body.user.id}/remove`).send({ password: ADMIN.password }).expect(200);

    await stein.get('/api/admin/orders').expect(401);
    expect((await client.get('/api/admin/admins')).body).toHaveLength(1);
    expect((await client.get('/api/admin/account')).body.audit.map((a: { action: string }) => a.action)).toEqual(expect.arrayContaining(['admin_created', 'admin_removed']));
  });

  it('is only for signed-in admins', async () => {
    const ctx = setup();
    await signedIn(ctx);
    await adminClient(request.agent(ctx.app)).get('/api/admin/admins').expect(401);
    await adminClient(request.agent(ctx.app)).post('/api/admin/admins').send({ name: 'X', email: 'x@example.com', password: ADMIN.password }).expect(401);
  });
});
