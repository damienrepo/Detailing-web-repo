import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import type { EstadioPublicInfo } from '../../shared/estadio';
import { Notice } from '../components/ui';
import { api } from '../lib/api';
import Booking from './Booking';
import Manage from './Manage';
import { Footer, Header } from './parts';

/** The packages, texts and free times; loaded once and again after a booking changes something. */
export function useEstadioInfo(except?: string) {
  const [info, setInfo] = useState<EstadioPublicInfo>();
  const [error, setError] = useState<string>();
  const reload = useCallback(async () => {
    setError(undefined);
    try {
      setInfo(await api<EstadioPublicInfo>(`/estadio${except ? `?boeking=${encodeURIComponent(except)}` : ''}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Laden is niet gelukt.');
    }
  }, [except]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { info, error, reload };
}

export type InfoState = ReturnType<typeof useEstadioInfo>;

function ScrollToTop() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname, search]);
  return null;
}

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="container-page py-16">
      <Notice tone="error">
        {message}{' '}
        <button type="button" onClick={onRetry} className="font-semibold underline underline-offset-2">
          Opnieuw proberen
        </button>
      </Notice>
    </div>
  );
}

export function Loading() {
  return (
    <div className="container-page space-y-4 py-10" aria-label="Laden" aria-busy>
      <div className="h-8 w-2/3 animate-pulse bg-paper-3" />
      <div className="h-64 animate-pulse bg-paper-3" />
      <div className="h-64 animate-pulse bg-paper-3" />
    </div>
  );
}

export default function EstadioApp() {
  const [siteUrl, setSiteUrl] = useState<string>();
  return (
    <div className="flex min-h-dvh flex-col">
      <ScrollToTop />
      <Header />
      <main id="main" className="flex-1">
        <Routes>
          <Route index element={<Booking onSiteUrl={setSiteUrl} />} />
          <Route path="boeking/:publicId" element={<Manage onSiteUrl={setSiteUrl} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer siteUrl={siteUrl} />
    </div>
  );
}
