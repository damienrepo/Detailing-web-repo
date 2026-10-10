import {
  CalendarCheck,
  CreditCard,
  ExternalLink,
  FileText,
  Heart,
  Home,
  Image,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Package,
  ShieldCheck,
  ShoppingBag,
  Truck,
  Store,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router';
import { Logo } from '../components/Logo';
import { Button, Input, Notice } from '../components/ui';
import { api } from '../lib/api';
import { DEMO } from '../lib/demo';
import { usePageMeta } from '../lib/meta';
import { hasUnsavedChanges, ToastProvider } from './kit';
import { AboutEditor } from './pages/AboutPage';
import { AccountPage } from './pages/Account';
import { BusinessPage } from './pages/Business';
import { Dashboard } from './pages/Dashboard';
import { EmailsPage } from './pages/Emails';
import { HomePageEditor } from './pages/HomePage';
import { MediaPage } from './pages/Media';
import { BookingsPage, OrdersPage } from './pages/Orders';
import { PostEditor, PostsPage } from './pages/Posts';
import { ProductEditor, ProductsPage } from './pages/Products';
import { ServiceEditor, ServicesPage } from './pages/Services';
import { SettingsPage } from './pages/Settings';
import { ShippingPage } from './pages/Shipping';
import { TeamMemberEditor, TeamPage } from './pages/Team';

export type AdminUser = { id: number; email: string; name: string; totpEnabled: boolean };
type Session = { state: 'setup' } | { state: 'login' } | { state: '2fa' } | { state: 'ok'; user: AdminUser };

export default function AdminApp() {
  usePageMeta('Beheer', undefined, { noindex: true });
  const [session, setSession] = useState<Session>();
  const [error, setError] = useState<string>();

  const check = useCallback(async () => {
    try {
      setSession(await api<Session>('/admin/session'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'De server is niet bereikbaar.');
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  if (error) return <AuthFrame title="Beheer">{<Notice tone="error">{error}</Notice>}</AuthFrame>;
  if (!session) return <div className="min-h-screen bg-ink" />;
  if (session.state === 'setup') return <SetupScreen onDone={setSession} />;
  if (session.state === 'login') return <LoginScreen onDone={setSession} />;
  if (session.state === '2fa') return <TwoFactorScreen onDone={setSession} onCancel={() => setSession({ state: 'login' })} />;
  return (
    <ToastProvider>
      <Shell user={session.user} onLogout={() => setSession({ state: 'login' })} onUserChange={(user) => setSession({ state: 'ok', user })} />
    </ToastProvider>
  );
}

// --- Sign-in screens ------------------------------------------------------------------

function AuthFrame({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-ink px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-paper">
          <Logo />
        </div>
        <div className="bg-paper p-7 text-ink md:p-9">
          <h1 className="font-display text-3xl">{title}</h1>
          {intro && <div className="mt-3 text-[15px] leading-relaxed text-stone-dark">{intro}</div>}
          <div className="mt-7">{children}</div>
        </div>
        <p className="mt-6 text-center text-xs text-paper/40">Beveiligde verbinding · alleen voor beheerders</p>
      </div>
    </div>
  );
}

function PasswordInput({ label, value, onChange, autoComplete, hint, error }: { label: string; value: string; onChange: (v: string) => void; autoComplete: string; hint?: string; error?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input label={label} type={show ? 'text' : 'password'} autoComplete={autoComplete} value={value} hint={hint} error={error} onChange={(e) => onChange(e.target.value)} className="pr-20" />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-[38px] text-sm text-stone-dark underline underline-offset-2 hover:text-ink">
        {show ? 'Verberg' : 'Toon'}
      </button>
    </div>
  );
}

function strengthHint(password: string) {
  if (!password) return 'Minimaal 12 tekens. Een korte zin werkt goed, bijv. "glans-op-de-oprit-2026".';
  if (password.length < 12) return `Nog ${12 - password.length} ${12 - password.length === 1 ? 'teken' : 'tekens'} te gaan.`;
  return password.length >= 16 ? 'Sterk wachtwoord.' : 'Goed. Nog langer is nog veiliger.';
}

function SetupScreen({ onDone }: { onDone: (s: Session) => void }) {
  const [form, setForm] = useState({ code: '', name: '', email: '', password: '', repeat: '' });
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (form.password !== form.repeat) return setError('De twee wachtwoorden zijn niet hetzelfde.');
    setBusy(true);
    setError(undefined);
    try {
      onDone(await api<Session>('/admin/setup', { body: { code: form.code, name: form.name, email: form.email, password: form.password } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aanmaken is niet gelukt.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame
      title="Welkom!"
      intro="Maak het beheerdersaccount aan met je setupcode."
    >
      <form onSubmit={submit} className="space-y-4">
        {error && <Notice tone="error">{error}</Notice>}
        <Input label="Setupcode" value={form.code} onChange={(e) => set('code')(e.target.value)} placeholder="ABCD-EFGH-JKLM" autoComplete="off" spellCheck={false} />
        <Input label="Je naam" value={form.name} onChange={(e) => set('name')(e.target.value)} autoComplete="name" />
        <Input label="E-mailadres" type="email" value={form.email} onChange={(e) => set('email')(e.target.value)} autoComplete="username" />
        <PasswordInput label="Kies een wachtwoord" value={form.password} onChange={set('password')} autoComplete="new-password" hint={strengthHint(form.password)} />
        <PasswordInput label="Herhaal het wachtwoord" value={form.repeat} onChange={set('repeat')} autoComplete="new-password" />
        <Button type="submit" variant="dark" className="w-full" disabled={busy || !form.code || !form.email || form.password.length < 12}>
          {busy ? 'Bezig…' : 'Account aanmaken'}
        </Button>
      </form>
    </AuthFrame>
  );
}

function LoginScreen({ onDone }: { onDone: (s: Session) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      onDone(await api<Session>('/admin/login', { body: { email, password } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Inloggen is niet gelukt.');
      setPassword('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame title="Inloggen" intro={DEMO ? 'Demo: vul een willekeurig e-mailadres en wachtwoord in.' : 'Log in om je webshop en website te beheren.'}>
      <form onSubmit={submit} className="space-y-4">
        {error && <Notice tone="error">{error}</Notice>}
        <Input label="E-mailadres" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" autoFocus />
        <PasswordInput label="Wachtwoord" value={password} onChange={setPassword} autoComplete="current-password" />
        <Button type="submit" variant="dark" className="w-full" disabled={busy || !email || !password}>
          {busy ? 'Bezig met inloggen…' : 'Inloggen'}
        </Button>
        <p className="text-sm leading-relaxed text-stone-dark">
          Wachtwoord vergeten? Op de server kun je met <code>npm run admin -- reset-password &lt;e-mail&gt;</code> een nieuw wachtwoord aanmaken.
        </p>
      </form>
    </AuthFrame>
  );
}

function TwoFactorScreen({ onDone, onCancel }: { onDone: (s: Session) => void; onCancel: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      onDone(await api<Session>('/admin/login/2fa', { body: { code } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Controleren is niet gelukt.');
      setCode('');
      if (err instanceof Error && /verlopen/.test(err.message)) onCancel();
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame title="Bevestig dat jij het bent" intro="Open je authenticator-app en vul de code van 6 cijfers in die bij Detail2Go staat.">
      <form onSubmit={submit} className="space-y-4">
        {error && <Notice tone="error">{error}</Notice>}
        <Input
          label="Code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          className="text-center font-mono text-2xl tracking-[0.4em]"
        />
        <Button type="submit" variant="dark" className="w-full" disabled={busy || code.length !== 6}>
          {busy ? 'Controleren…' : 'Doorgaan'}
        </Button>
        <button type="button" onClick={onCancel} className="w-full text-sm text-stone-dark underline underline-offset-2 hover:text-ink">
          Terug naar inloggen
        </button>
      </form>
    </AuthFrame>
  );
}

// --- Shell -----------------------------------------------------------------------------

const NAV: { group: string; items: { to: string; label: string; icon: typeof Home; end?: boolean }[] }[] = [
  { group: '', items: [{ to: '/admin', label: 'Overzicht', icon: LayoutDashboard, end: true }] },
  {
    group: 'Verkoop',
    items: [
      { to: '/admin/bestellingen', label: 'Bestellingen', icon: ShoppingBag },
      { to: '/admin/afspraken', label: 'Afspraken', icon: CalendarCheck },
    ],
  },
  {
    group: 'Website',
    items: [
      { to: '/admin/blog', label: 'Blog', icon: FileText },
      { to: '/admin/producten', label: 'Producten', icon: Package },
      { to: '/admin/diensten', label: 'Diensten', icon: Wrench },
      { to: '/admin/team', label: 'Team', icon: Users },
      { to: '/admin/homepage', label: 'Homepage', icon: Home },
      { to: '/admin/over-ons', label: 'Over ons', icon: Heart },
      { to: '/admin/bedrijf', label: 'Bedrijfsgegevens', icon: Store },
      { to: '/admin/afbeeldingen', label: 'Afbeeldingen', icon: Image },
      { to: '/admin/emails', label: 'E-mails', icon: Mail },
    ],
  },
  {
    group: 'Instellingen',
    items: [
      { to: '/admin/verzending', label: 'Verzending & afhalen', icon: Truck },
      { to: '/admin/instellingen', label: 'Betalingen & e-mail', icon: CreditCard },
      { to: '/admin/account', label: 'Account & beveiliging', icon: ShieldCheck },
    ],
  },
];

function Shell({ user, onLogout, onUserChange }: { user: AdminUser; onLogout: () => void; onUserChange: (u: AdminUser) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo({ top: 0 });
  }, [pathname]);

  const guard = (e: React.MouseEvent) => {
    if (hasUnsavedChanges() && !window.confirm('Je hebt wijzigingen die nog niet zijn opgeslagen. Toch weggaan?')) e.preventDefault();
  };

  async function logout() {
    if (hasUnsavedChanges() && !window.confirm('Je hebt wijzigingen die nog niet zijn opgeslagen. Toch uitloggen?')) return;
    await api('/admin/logout', { method: 'POST', body: {} }).catch(() => {});
    onLogout();
    navigate('/admin');
  }

  const nav = (
    <nav aria-label="Beheermenu" className="space-y-6">
      {NAV.map((section) => (
        <div key={section.group || 'main'}>
          {section.group && <p className="eyebrow mb-2 px-3 text-paper/40">{section.group}</p>}
          <ul className="space-y-0.5">
            {section.items.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  onClick={guard}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 text-[15px] transition-colors ${isActive ? 'bg-white/10 text-paper' : 'text-paper/70 hover:bg-white/5 hover:text-paper'}`
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-paper text-ink lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="hidden bg-ink text-paper lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="flex h-16 items-center px-6">
          <Logo />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">{nav}</div>
        <UserBox user={user} onLogout={logout} />
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-ink px-4 text-paper lg:hidden">
        <Logo />
        <button type="button" onClick={() => setMenuOpen((v) => !v)} className="grid h-10 w-10 place-items-center" aria-expanded={menuOpen} aria-label={menuOpen ? 'Menu sluiten' : 'Menu openen'}>
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>
      {menuOpen && (
        <div className="fixed inset-x-0 bottom-0 top-14 z-30 flex flex-col overflow-y-auto bg-ink text-paper lg:hidden">
          <div className="flex-1 px-3 py-4">{nav}</div>
          <UserBox user={user} onLogout={logout} />
        </div>
      )}

      <main className="min-w-0 px-4 py-8 md:px-8 md:py-10">
        <div className={`mx-auto ${pathname.startsWith('/admin/emails') ? 'max-w-7xl' : 'max-w-5xl'}`}>
          <Routes>
            <Route index element={<Dashboard user={user} />} />
            <Route path="bestellingen" element={<OrdersPage />} />
            <Route path="afspraken" element={<BookingsPage />} />
            <Route path="blog" element={<PostsPage />} />
            <Route path="blog/:id" element={<PostEditor />} />
            <Route path="producten" element={<ProductsPage />} />
            <Route path="producten/:id" element={<ProductEditor />} />
            <Route path="diensten" element={<ServicesPage />} />
            <Route path="diensten/:id" element={<ServiceEditor />} />
            <Route path="team" element={<TeamPage />} />
            <Route path="team/:id" element={<TeamMemberEditor />} />
            <Route path="homepage" element={<HomePageEditor />} />
            <Route path="over-ons" element={<AboutEditor />} />
            <Route path="bedrijf" element={<BusinessPage />} />
            <Route path="afbeeldingen" element={<MediaPage />} />
            <Route path="emails" element={<EmailsPage />} />
            <Route path="verzending" element={<ShippingPage />} />
            <Route path="instellingen" element={<SettingsPage />} />
            <Route path="account" element={<AccountPage user={user} onUserChange={onUserChange} />} />
            <Route path="*" element={<p className="text-stone-dark">Deze pagina bestaat niet.</p>} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function UserBox({ user, onLogout }: { user: AdminUser; onLogout: () => void }) {
  return (
    <div className="border-t border-white/10 p-4">
      <a href="/" target="_blank" rel="noreferrer" className="mb-3 flex items-center gap-2 px-2 text-sm text-paper/70 hover:text-paper">
        <ExternalLink className="h-4 w-4" aria-hidden />
        Website bekijken
      </a>
      <div className="flex items-center justify-between gap-3 px-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-paper/50">{user.email}</p>
        </div>
        <button type="button" onClick={onLogout} className="grid h-9 w-9 shrink-0 place-items-center text-paper/70 hover:bg-white/10 hover:text-paper" aria-label="Uitloggen" title="Uitloggen">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
