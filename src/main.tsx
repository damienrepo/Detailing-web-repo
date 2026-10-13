import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, MemoryRouter } from 'react-router';
import { applyContent } from '../shared/content';
import App from './App.tsx';
import './index.css';
import { DEMO } from './lib/demo';
import { initLanguage } from './lib/i18n';
import { initMetaPixel } from './lib/metaPixel';

// Content edited in the admin is embedded in the page by the server; apply it before the first render.
try {
  const embedded = document.getElementById('site-content')?.textContent;
  if (embedded) applyContent(JSON.parse(embedded));
} catch {
  // Fall back to the built-in content.
}

// English, when chosen before: start translating before the first render to avoid a flash of Dutch.
if (!DEMO) initLanguage();
// Meta Pixel, only after marketing consent (see the cookie banner).
initMetaPixel();

// The demo runs inside a hosted preview frame whose URL it cannot change, so it routes in memory.
const Router = DEMO ? MemoryRouter : BrowserRouter;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <App />
    </Router>
  </StrictMode>,
);
