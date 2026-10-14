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

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  if (DEMO) {
    const { demoApi } = await import('./demoApi');
    return demoApi<T>(path, options);
  }
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: options.method ?? (options.body ? 'POST' : 'GET'),
      credentials: 'same-origin',
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        // Required by the server for admin calls; plain cross-site forms cannot set it.
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError('Geen verbinding. Controleer je internet en probeer het opnieuw.', 0);
  }
  const text = await res.text().catch(() => '');
  let data: { error?: string; fields?: Record<string, string> } = {};
  try {
    if (text) data = JSON.parse(text);
  } catch {
    // An HTML page instead of data (a proxy, a captive portal or a restarting server): don't pass it off as a result.
    if (res.ok) throw new ApiError('De server gaf een onverwacht antwoord. Probeer het opnieuw.', res.status);
  }
  if (!res.ok) throw new ApiError(data.error ?? 'Er ging iets mis.', res.status, data.fields);
  return data as T;
}
