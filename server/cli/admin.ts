// Account recovery on the server itself, for when you cannot sign in to /admin.
//   npm run admin -- list
//   npm run admin -- create <e-mail> "<naam>"
//   npm run admin -- reset-password <e-mail>
//   npm run admin -- disable-2fa <e-mail>
//   npm run admin -- logout-all <e-mail>
// New and reset passwords are random and shown once; change them after signing in.
import crypto from 'node:crypto';
import { loadConfig } from '../config';
import { openDb } from '../db';
import { hashPassword } from '../security';

const config = loadConfig();
const db = openDb(config.databasePath);
const [command, emailArg, nameArg] = process.argv.slice(2);
const email = emailArg?.trim().toLowerCase();

function randomPassword() {
  // 4 groups of 5 characters from an unambiguous alphabet: ~100 bits.
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const chars = Array.from(crypto.randomBytes(20), (b) => alphabet[b % alphabet.length]).join('');
  return chars.match(/.{5}/g)!.join('-');
}

function findUser() {
  if (!email) fail('Geef een e-mailadres op.');
  const user = db.prepare('SELECT id, email, name FROM admin_users WHERE email = ?').get(email) as { id: number; email: string; name: string } | undefined;
  if (!user) fail(`Er is geen beheerder met e-mailadres ${email}.`);
  return user!;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function audit(userId: number, action: string) {
  db.prepare("INSERT INTO admin_audit (user_id, action, detail) VALUES (?, ?, 'via de server')").run(userId, action);
}

switch (command) {
  case 'list': {
    const users = db.prepare('SELECT email, name, totp_secret IS NOT NULL AS twofa, last_login_at FROM admin_users ORDER BY id').all();
    console.table(users);
    break;
  }
  case 'create': {
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail('Geef een geldig e-mailadres op.');
    const password = randomPassword();
    try {
      const info = db
        .prepare('INSERT INTO admin_users (email, name, password_hash) VALUES (?, ?, ?)')
        .run(email, nameArg?.trim() || email.split('@')[0], await hashPassword(password));
      audit(Number(info.lastInsertRowid), 'account_created');
    } catch {
      fail(`Er bestaat al een beheerder met e-mailadres ${email}.`);
    }
    console.log(`Beheerder aangemaakt.\nE-mail:     ${email}\nWachtwoord: ${password}\nWijzig dit wachtwoord na het inloggen.`);
    break;
  }
  case 'reset-password': {
    const user = findUser();
    const password = randomPassword();
    db.prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?').run(await hashPassword(password), user.id);
    db.prepare('DELETE FROM admin_sessions WHERE user_id = ?').run(user.id);
    audit(user.id, 'password_reset');
    console.log(`Nieuw wachtwoord voor ${user.email}: ${password}\nAlle sessies zijn uitgelogd. Wijzig dit wachtwoord na het inloggen.`);
    break;
  }
  case 'disable-2fa': {
    const user = findUser();
    db.prepare('UPDATE admin_users SET totp_secret = NULL, totp_last_counter = NULL WHERE id = ?').run(user.id);
    db.prepare('DELETE FROM admin_sessions WHERE user_id = ?').run(user.id);
    audit(user.id, '2fa_disabled');
    console.log(`Tweestapsverificatie uitgezet voor ${user.email}. Zet hem na het inloggen opnieuw aan.`);
    break;
  }
  case 'logout-all': {
    const user = findUser();
    db.prepare('DELETE FROM admin_sessions WHERE user_id = ?').run(user.id);
    audit(user.id, 'sessions_revoked');
    console.log(`Alle sessies van ${user.email} zijn uitgelogd.`);
    break;
  }
  default:
    console.log('Gebruik: npm run admin -- <list | create <e-mail> "<naam>" | reset-password <e-mail> | disable-2fa <e-mail> | logout-all <e-mail>>');
}
