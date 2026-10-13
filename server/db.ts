import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export type Db = Database.Database;

const MIGRATIONS: string[] = [
  `CREATE TABLE orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    public_id TEXT NOT NULL UNIQUE,
    number TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'open',
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    street TEXT NOT NULL,
    house_number TEXT NOT NULL,
    postal_code TEXT NOT NULL,
    city TEXT NOT NULL,
    country TEXT NOT NULL,
    notes TEXT,
    subtotal INTEGER NOT NULL,
    shipping INTEGER NOT NULL,
    vat INTEGER NOT NULL,
    total INTEGER NOT NULL,
    payment_id TEXT UNIQUE,
    payment_method TEXT,
    tracking_code TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    paid_at TEXT,
    shipped_at TEXT
  );
  CREATE TABLE order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL,
    sku TEXT NOT NULL,
    name TEXT NOT NULL,
    unit_price INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    line_total INTEGER NOT NULL
  );
  CREATE INDEX order_items_order_id ON order_items(order_id);
  CREATE TABLE bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status TEXT NOT NULL DEFAULT 'new',
    service_id TEXT NOT NULL,
    vehicle TEXT NOT NULL,
    preferred_date TEXT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    postal_code TEXT,
    message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,
  // Admin accounts, sessions and audit log; encrypted settings; editable content, blog and media.
  `CREATE TABLE admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    totp_secret TEXT,
    totp_last_counter INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_login_at TEXT
  );
  CREATE TABLE admin_sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    stage TEXT NOT NULL DEFAULT 'full',
    created_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    ip TEXT,
    user_agent TEXT
  );
  CREATE INDEX admin_sessions_user ON admin_sessions(user_id);
  CREATE TABLE admin_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    detail TEXT,
    ip TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE content (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    excerpt TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    cover TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    published_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX posts_published ON posts(status, published_at);
  CREATE TABLE media (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    alt TEXT NOT NULL DEFAULT '',
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    bytes INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,
  // Pickup as a shipping method, with its own steps: ready for pickup, collected.
  `ALTER TABLE orders ADD COLUMN shipping_method TEXT NOT NULL DEFAULT 'delivery';
  ALTER TABLE orders ADD COLUMN ready_at TEXT;
  ALTER TABLE orders ADD COLUMN collected_at TEXT;`,
  // Team members for the /team page.
  `CREATE TABLE team_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    bio TEXT NOT NULL DEFAULT '',
    quote TEXT NOT NULL DEFAULT '',
    photo TEXT,
    facts TEXT NOT NULL DEFAULT '[]',
    visible INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,
  // Cookieless website statistics (see server/analytics.ts). Times are epoch milliseconds.
  `CREATE TABLE analytics_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visitor TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    entry_path TEXT NOT NULL,
    channel TEXT NOT NULL,
    referrer TEXT,
    utm_campaign TEXT,
    device TEXT NOT NULL,
    browser TEXT NOT NULL,
    os TEXT NOT NULL,
    country TEXT NOT NULL,
    language TEXT NOT NULL
  );
  CREATE INDEX analytics_sessions_started ON analytics_sessions(started_at);
  CREATE INDEX analytics_sessions_visitor ON analytics_sessions(visitor, last_seen_at);
  CREATE TABLE analytics_pageviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES analytics_sessions(id) ON DELETE CASCADE,
    client_id TEXT NOT NULL UNIQUE,
    path TEXT NOT NULL,
    title TEXT,
    created_at INTEGER NOT NULL,
    duration INTEGER NOT NULL DEFAULT 0,
    scroll INTEGER,
    load_ms INTEGER
  );
  CREATE INDEX analytics_pageviews_session ON analytics_pageviews(session_id);
  CREATE TABLE analytics_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES analytics_sessions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    label TEXT,
    value INTEGER,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX analytics_events_session ON analytics_events(session_id);
  CREATE INDEX analytics_events_name ON analytics_events(name, label);
  CREATE TABLE analytics_salt (
    day TEXT PRIMARY KEY,
    salt TEXT NOT NULL
  );`,
  // Stored machine translations of the site's texts (see server/translate.ts).
  `CREATE TABLE translations (
    lang TEXT NOT NULL,
    source TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (lang, source)
  ) WITHOUT ROWID;`,
  // Meta Conversions API: what is needed to send the Purchase server-side, stored only with marketing consent,
  // and the state of that send (see server/meta.ts).
  `ALTER TABLE orders ADD COLUMN marketing_consent INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE orders ADD COLUMN fbp TEXT;
  ALTER TABLE orders ADD COLUMN fbc TEXT;
  ALTER TABLE orders ADD COLUMN client_ip TEXT;
  ALTER TABLE orders ADD COLUMN client_user_agent TEXT;
  ALTER TABLE orders ADD COLUMN event_source_url TEXT;
  ALTER TABLE orders ADD COLUMN meta_purchase_sent_at TEXT;
  ALTER TABLE orders ADD COLUMN meta_attempts INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE orders ADD COLUMN meta_claimed_at INTEGER;
  ALTER TABLE orders ADD COLUMN meta_last_error TEXT;`,
];

export function openDb(file: string): Db {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

function migrate(db: Db) {
  const version = db.pragma('user_version', { simple: true }) as number;
  for (let i = version; i < MIGRATIONS.length; i++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[i]);
      db.pragma(`user_version = ${i + 1}`);
    })();
  }
}
