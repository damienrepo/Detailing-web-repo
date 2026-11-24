import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { phoneToHref, SITE } from '../../shared/site';
import EstadioApp from './EstadioApp';
import './estadio.css';

// Company details edited in the admin are embedded by the server. Only the contact details are needed here, so
// the page skips the rest of the site's content (and stays small on phones).
try {
  const embedded = document.getElementById('site-content')?.textContent;
  const site = embedded ? (JSON.parse(embedded) as { site?: Partial<typeof SITE> }).site : undefined;
  if (site) {
    Object.assign(SITE, site);
    SITE.phoneHref = phoneToHref(SITE.phone);
    SITE.whatsapp = `https://wa.me/${SITE.phoneHref.replace(/^\+/, '')}`;
  }
} catch {
  // Keep the built-in details.
}

// The page lives under /estadio on the main site (or at the root of its own host when ESTADIO_URL is a subdomain).
const basename = /^\/estadio(\/|$)/.test(location.pathname) ? '/estadio' : '/';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <EstadioApp />
    </BrowserRouter>
  </StrictMode>,
);
