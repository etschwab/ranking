import { db } from '@/db/client';
import { ensureSchema } from '@/db/rankings';
import { hashPassword, verifyPassword } from '@/lib/passwords';
import type { RanklyUser } from '@/app/auth';

type AccountRow = { id: string; email: string; displayName: string; passwordHash: string | null; googleSub: string | null };

function normalizeEmail(email: string) {
  return email.trim().toLocaleLowerCase('en-US');
}

export async function registerWithEmail(email: string, password: string, displayName: string) {
  await ensureSchema();
  const normalizedEmail = normalizeEmail(email);
  const existing = await db.prepare('SELECT id FROM users WHERE email = ?').bind(normalizedEmail).first<{ id: string }>();
  if (existing) return null;
  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  await db.batch([
    db.prepare('INSERT INTO users (id, email, password_hash, google_sub, display_name, created_at) VALUES (?, ?, ?, NULL, ?, ?)').bind(userId, normalizedEmail, passwordHash, displayName, Date.now()),
    db.prepare('INSERT INTO user_profiles (user_id, display_name, email, updated_at) VALUES (?, ?, ?, ?)').bind(userId, displayName, normalizedEmail, Date.now()),
  ]);
  return userId;
}

export async function authenticateWithEmail(email: string, password: string) {
  await ensureSchema();
  const account = await db.prepare('SELECT id, password_hash AS passwordHash FROM users WHERE email = ?').bind(normalizeEmail(email)).first<{ id: string; passwordHash: string | null }>();
  if (!account?.passwordHash || !await verifyPassword(password, account.passwordHash)) return null;
  return account.id;
}

export async function findOrCreateGoogleUser(input: { sub: string; email: string; displayName: string }) {
  await ensureSchema();
  const email = normalizeEmail(input.email);
  const existing = await db.prepare('SELECT id, email, display_name AS displayName, password_hash AS passwordHash, google_sub AS googleSub FROM users WHERE google_sub = ? OR email = ? ORDER BY CASE WHEN google_sub = ? THEN 0 ELSE 1 END LIMIT 1').bind(input.sub, email, input.sub).first<AccountRow>();
  if (existing) {
    await db.batch([
      db.prepare('UPDATE users SET google_sub = ?, display_name = ? WHERE id = ?').bind(input.sub, existing.displayName || input.displayName, existing.id),
      db.prepare('INSERT INTO user_profiles (user_id, display_name, email, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET email = excluded.email, updated_at = excluded.updated_at').bind(existing.id, existing.displayName || input.displayName, email, Date.now()),
    ]);
    return existing.id;
  }
  const userId = crypto.randomUUID();
  await db.batch([
    db.prepare('INSERT INTO users (id, email, password_hash, google_sub, display_name, created_at) VALUES (?, ?, NULL, ?, ?, ?)').bind(userId, email, input.sub, input.displayName, Date.now()),
    db.prepare('INSERT INTO user_profiles (user_id, display_name, email, updated_at) VALUES (?, ?, ?, ?)').bind(userId, input.displayName, email, Date.now()),
  ]);
  return userId;
}

export async function updateAccountName(user: RanklyUser, displayName: string) {
  await ensureSchema();
  await db.prepare('UPDATE users SET display_name = ? WHERE id = ?').bind(displayName, user.userId).run();
}

export async function migrateLegacyAccount(legacyUserId: string | null, userId: string, email: string) {
  if (!legacyUserId || legacyUserId === userId) return;
  await ensureSchema();
  await db.batch([
    db.prepare('UPDATE ranking_owners SET user_id = ?, email = ? WHERE user_id = ?').bind(userId, email, legacyUserId),
    db.prepare('UPDATE ballots SET user_id = ? WHERE user_id = ?').bind(userId, legacyUserId),
    db.prepare('UPDATE comments SET user_id = ? WHERE user_id = ?').bind(userId, legacyUserId),
    db.prepare('UPDATE reactions SET user_id = ? WHERE user_id = ?').bind(userId, legacyUserId),
  ]);
}
