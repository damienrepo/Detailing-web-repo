// Runtime settings from the server (/api/config), fetched once and shared.
export type SiteConfig = { payments?: string; translate?: boolean; metaPixelId?: string };

let pending: Promise<SiteConfig> | undefined;

export function getSiteConfig(): Promise<SiteConfig> {
  pending ??= fetch('/api/config')
    .then((res) => (res.ok ? (res.json() as Promise<SiteConfig>) : {}))
    .catch(() => ({}));
  return pending;
}
