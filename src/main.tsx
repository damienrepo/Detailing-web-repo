import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, MemoryRouter } from 'react-router';
import { applyContent } from '../shared/content';
import App from './App.tsx';
import './index.css';
import { DEMO } from './lib/demo';

// Content edited in the admin is embedded in the page by the server; apply it before the first render.
try {
  const embedded = document.getElementById('site-content')?.textContent;
  if (embedded) applyContent(JSON.parse(embedded));
} catch {
  // Fall back to the built-in content.
}

// The demo runs inside a hosted preview frame whose URL it cannot change, so it routes in memory.
const Router = DEMO ? MemoryRouter : BrowserRouter;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <App />
    </Router>
  </StrictMode>,
);
