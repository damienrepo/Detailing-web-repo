import { lazy, Suspense, useEffect } from 'react';
import { Link, Outlet, Route, Routes, useLocation } from 'react-router';
import { CartDrawer } from './components/CartDrawer';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { CartProvider } from './lib/cart';
import { DEMO } from './lib/demo';
import Home from './pages/Home';
import Shop from './pages/Shop';
import ProductPage from './pages/Product';
import NotFound from './pages/NotFound';

const Checkout = lazy(() => import('./pages/Checkout'));
const OrderStatus = lazy(() => import('./pages/OrderStatus'));
const Booking = lazy(() => import('./pages/Booking'));
const Contact = lazy(() => import('./pages/Contact'));
const Legal = lazy(() => import('./pages/Legal'));
const Admin = lazy(() => import('./pages/Admin'));
const DemoPayment = lazy(() => import('./pages/DemoPayment'));

/** Scrolls to the top on navigation, or to the #anchor when the URL has one. */
function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      // Wait a frame so the target section has rendered after a route change.
      const id = decodeURIComponent(hash.slice(1));
      requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }));
      return;
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname, hash]);
  return null;
}

function Layout() {
  return (
    <>
      <Header />
      <main id="main" tabIndex={-1} className="outline-none">
        <Suspense fallback={<div className="min-h-screen bg-paper" />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
      <CartDrawer />
      {DEMO && <DemoBadge />}
    </>
  );
}

function DemoBadge() {
  return (
    <>
      {/* Room below the footer so the badge never covers its links. */}
      <div aria-hidden className="h-16 bg-ink" />
      <div className="fixed bottom-[calc(12px+env(safe-area-inset-bottom,0px))] left-3 z-30 flex items-center gap-3 border border-white/15 bg-ink/95 px-3 py-2 text-xs text-paper shadow-lg">
        <span>
          <strong className="text-accent">Demo</strong> · er wordt niets echt besteld
        </span>
        <Link to="/admin" className="underline underline-offset-2">
          Beheer
        </Link>
      </div>
    </>
  );
}

export default function App() {
  return (
    <CartProvider>
      <ScrollManager />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="shop" element={<Shop />} />
          <Route path="shop/:slug" element={<ProductPage />} />
          <Route path="afrekenen" element={<Checkout />} />
          <Route path="bestelling/:publicId" element={<OrderStatus />} />
          <Route path="afspraak" element={<Booking />} />
          <Route path="contact" element={<Contact />} />
          <Route path="voorwaarden" element={<Legal page="voorwaarden" />} />
          <Route path="privacy" element={<Legal page="privacy" />} />
          <Route path="retourneren" element={<Legal page="retourneren" />} />
          <Route path="verzending" element={<Legal page="verzending" />} />
          {DEMO && <Route path="demo-betaling/:publicId" element={<DemoPayment />} />}
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route
          path="admin"
          element={
            <Suspense fallback={null}>
              <Admin />
            </Suspense>
          }
        />
      </Routes>
    </CartProvider>
  );
}
