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
