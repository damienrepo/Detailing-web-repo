import crypto from 'node:crypto';
import { toMollieAmount } from '../shared/pricing';

export type PaymentStatus = 'open' | 'paid' | 'failed';

export type CreatePaymentInput = {
  amount: number; // cents
  description: string;
  redirectUrl: string;
  webhookUrl?: string;
  orderPublicId: string;
};

export type Payment = {
  id: string;
  status: PaymentStatus;
  method?: string;
  checkoutUrl?: string;
  orderPublicId?: string;
};

export interface PaymentProvider {
  readonly mode: 'live' | 'test' | 'mock';
  create(input: CreatePaymentInput): Promise<Payment>;
  get(id: string): Promise<Payment>;
}

export function mapMollieStatus(status: string): PaymentStatus {
  if (status === 'paid') return 'paid';
  if (status === 'canceled' || status === 'expired' || status === 'failed') return 'failed';
  return 'open'; // open, pending, authorized
}

type MolliePayment = {
  id: string;
  status: string;
  method?: string | null;
  metadata?: { order?: string } | null;
  _links?: { checkout?: { href: string } };
};

/** Mollie Payments API v2 — https://docs.mollie.com/reference/create-payment */
export class MollieProvider implements PaymentProvider {
  readonly mode: 'live' | 'test';

  constructor(
    private apiKey: string,
    private fetchImpl: typeof fetch = fetch,
  ) {
    this.mode = apiKey.startsWith('live_') ? 'live' : 'test';
  }

  private async request(method: string, path: string, body?: unknown): Promise<MolliePayment> {
    const res = await this.fetchImpl(`https://api.mollie.com/v2${path}`, {
      method,
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Mollie ${method} ${path} failed: ${res.status} ${text.slice(0, 300)}`);
    }
    return (await res.json()) as MolliePayment;
  }

  private toPayment(p: MolliePayment): Payment {
    return {
      id: p.id,
      status: mapMollieStatus(p.status),
      method: p.method ?? undefined,
      checkoutUrl: p._links?.checkout?.href,
      orderPublicId: p.metadata?.order,
    };
  }

  async create(input: CreatePaymentInput): Promise<Payment> {
    const payment = await this.request('POST', '/payments', {
      amount: { currency: 'EUR', value: toMollieAmount(input.amount) },
      description: input.description,
      redirectUrl: input.redirectUrl,
      ...(input.webhookUrl ? { webhookUrl: input.webhookUrl } : {}),
      locale: 'nl_NL',
      metadata: { order: input.orderPublicId },
    });
    return this.toPayment(payment);
  }

  async get(id: string): Promise<Payment> {
    return this.toPayment(await this.request('GET', `/payments/${encodeURIComponent(id)}`));
  }
}

/**
 * Stand-in for Mollie during local development and tests. The checkout page it
 * links to is served by the app itself (see /api/dev/mock-checkout).
 */
export class MockProvider implements PaymentProvider {
  readonly mode = 'mock' as const;
  readonly payments = new Map<string, Payment & { redirectUrl: string }>();

  constructor(private appUrl: string) {}

  async create(input: CreatePaymentInput): Promise<Payment> {
    const id = `tr_mock_${crypto.randomBytes(6).toString('hex')}`;
    const payment = {
      id,
      status: 'open' as const,
      checkoutUrl: `${this.appUrl}/api/dev/mock-checkout/${id}`,
      redirectUrl: input.redirectUrl,
      orderPublicId: input.orderPublicId,
    };
    this.payments.set(id, payment);
    return payment;
  }

  async get(id: string): Promise<Payment> {
    const payment = this.payments.get(id);
    if (!payment) throw new Error(`Unknown mock payment ${id}`);
    return payment;
  }

  settle(id: string, status: PaymentStatus) {
    const payment = this.payments.get(id);
    if (!payment) return undefined;
    payment.status = status;
    payment.method = status === 'paid' ? 'ideal' : undefined;
    return payment;
  }
}

/** Checks a Mollie API key against the Mollie API; resolves with a Dutch error message on failure. */
export async function verifyMollieKey(apiKey: string, fetchImpl: typeof fetch = fetch): Promise<string | undefined> {
  try {
    const res = await fetchImpl('https://api.mollie.com/v2/methods', { headers: { Authorization: `Bearer ${apiKey}` } });
    if (res.ok) return undefined;
    if (res.status === 401) return 'Mollie herkent deze API-key niet. Kopieer hem opnieuw uit je Mollie-dashboard.';
    return `Mollie gaf een onverwachte fout (${res.status}). Probeer het later opnieuw.`;
  } catch {
    return 'Kan Mollie niet bereiken. Controleer de internetverbinding van de server.';
  }
}

/**
 * Picks the payment provider from the current settings: Mollie when a key is set, the
 * mock checkout during development, otherwise none (checkout disabled).
 */
export function createPaymentResolver(getKey: () => string | undefined, options: { production: boolean; appUrl: string }) {
  const mock = options.production ? undefined : new MockProvider(options.appUrl);
  let cached: { key: string; provider: MollieProvider } | undefined;
  return (): PaymentProvider | undefined => {
    const key = getKey();
    if (!key) return mock;
    if (cached?.key !== key) cached = { key, provider: new MollieProvider(key) };
    return cached.provider;
  };
}
