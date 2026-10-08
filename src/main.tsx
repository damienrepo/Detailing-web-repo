import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, MemoryRouter } from 'react-router';
import App from './App.tsx';
import './index.css';
import { DEMO } from './lib/demo';

// The demo runs inside a hosted preview frame whose URL it cannot change, so it routes in memory.
const Router = DEMO ? MemoryRouter : BrowserRouter;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <App />
    </Router>
  </StrictMode>,
);
