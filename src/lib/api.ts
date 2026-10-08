import { DEMO } from './demo';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

export async function api<T>(path: string, options: { method?: string; body?: unknown; token?: string } = {}): Promise<T> {
  if (DEMO) {
    const { demoApi } = await import('./demoApi');
    return demoApi<T>(path, options);
  }
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: options.method ?? (options.body ? 'POST' : 'GET'),
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError('Geen verbinding. Controleer je internet en probeer het opnieuw.', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? 'Er ging iets mis.', res.status, data.fields);
  return data as T;
}
