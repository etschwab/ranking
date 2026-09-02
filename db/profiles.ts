import type { RanklyUser } from '@/app/auth';
import { db } from '@/db/client';
import { ensureSchema } from '@/db/rankings';
import { updateAccountName } from '@/db/accounts';

export type UserProfile = {
  displayName: string;
  email: string;
};

export async function getUserProfile(user: RanklyUser): Promise<UserProfile> {
  await ensureSchema();
  const profile = await db.prepare(
    'SELECT display_name AS displayName, email FROM user_profiles WHERE user_id = ?',
  ).bind(user.userId).first<UserProfile>();
  return profile ?? { displayName: user.displayName, email: user.email };
}

export async function saveUserProfile(user: RanklyUser, displayName: string): Promise<UserProfile> {
  await ensureSchema();
  await updateAccountName(user, displayName);
  await db.prepare(`
    INSERT INTO user_profiles (user_id, display_name, email, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      display_name = excluded.display_name,
      email = excluded.email,
      updated_at = excluded.updated_at
  `).bind(user.userId, displayName, user.email, Date.now()).run();
  return { displayName, email: user.email };
}
