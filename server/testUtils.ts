// Shared setup for the server tests.
import request from 'supertest';
import { createApp } from './app';
import { Auth } from './auth';
import { loadConfig, type Config } from './config';
import { openDb } from './db';
import type { Mail } from './mail';
import { MockProvider } from './payments';
import { createCipher } from './security';
import crypto from 'node:crypto';

export const ADMIN = { email: 'beheer@example.com', name: 'Beheer', password: 'lange-zin-voor-tests-42' };
/** Requests to admin routes must look like they come from our own pages. */
export const HOST = 'shop.test';

export function setup(overrides: Partial<Config> = {}) {
  const config = { ...loadConfig({}), notifyEmail: 'shop@example.com', ...overrides };
  const db = openDb(':memory:');
  const cipher = createCipher(crypto.randomBytes(32));
  const auth = new Auth(db, cipher, false);
  const payments = new MockProvider(config.appUrl);
  const sent: Mail[] = [];
  const app = createApp({ config, db, cipher, auth, payments, mailer: { send: async (m) => void sent.push(m) } });
  return { app, db, auth, cipher, payments, sent, config };
}

type Agent = ReturnType<typeof request.agent>;

/** Wraps an agent so every call carries the same-origin headers the admin requires. */
export function adminClient(agent: Agent) {
  const prep = <T extends { set(k: string, v: string): T }>(r: T) =>
    r.set('Host', HOST).set('Origin', `http://${HOST}`).set('X-Requested-With', 'XMLHttpRequest');
  return {
    get: (url: string) => prep(agent.get(url)),
    post: (url: string) => prep(agent.post(url)),
    put: (url: string) => prep(agent.put(url)),
    patch: (url: string) => prep(agent.patch(url)),
    delete: (url: string) => prep(agent.delete(url)),
  };
}

/** Creates the admin account and returns a signed-in client. */
export async function signedIn(ctx: ReturnType<typeof setup>) {
  if (!ctx.auth.hasUsers()) await ctx.auth.createUser(ADMIN);
  const client = adminClient(request.agent(ctx.app));
  await client.post('/api/admin/login').send({ email: ADMIN.email, password: ADMIN.password }).expect(200);
  return client;
}
