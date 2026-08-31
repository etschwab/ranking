import { env } from 'cloudflare:workers';
import type { ChatGPTUser } from '@/app/chatgpt-auth';
import { ensureSchema } from '@/db/rankings';

export type UserProfile = {
  displayName: string;
  email: string;
};

export async function getUserProfile(user: ChatGPTUser): Promise<UserProfile> {
  await ensureSchema();
  const profile = await env.DB.prepare(
    'SELECT display_name AS displayName, email FROM user_profiles WHERE user_id = ?',
  ).bind(user.userId).first<UserProfile>();
  return profile ?? { displayName: user.displayName, email: user.email };
}

export async function saveUserProfile(user: ChatGPTUser, displayName: string): Promise<UserProfile> {
  await ensureSchema();
  await env.DB.prepare(`
    INSERT INTO user_profiles (user_id, display_name, email, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      display_name = excluded.display_name,
      email = excluded.email,
      updated_at = excluded.updated_at
  `).bind(user.userId, displayName, user.email, Date.now()).run();
  return { displayName, email: user.email };
}
