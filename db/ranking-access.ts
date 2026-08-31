import { db } from '@/db/client';
import { ensureSchema, type RankingAccessMode } from '@/db/rankings';

export type RankingAccess = {
  id: string;
  accessMode: RankingAccessMode;
  passwordHash: string | null;
  inviteToken: string | null;
  accessToken: string | null;
  isOwner: boolean;
};

export function accessCookieName(slug: string) {
  return `rankly-access-${slug}`;
}

export async function getRankingAccess(slug: string, userId?: string): Promise<RankingAccess | null> {
  await ensureSchema();
  return db.prepare(`
    SELECT r.id, r.access_mode AS accessMode, r.password_hash AS passwordHash,
      r.invite_token AS inviteToken, r.access_token AS accessToken,
      CASE WHEN o.user_id = ? THEN 1 ELSE 0 END AS isOwner
    FROM rankings r
    LEFT JOIN ranking_owners o ON o.ranking_id = r.id
    WHERE r.slug = ?
  `).bind(userId ?? '', slug).first<RankingAccess>();
}

function cookieValue(request: Request, name: string) {
  const cookies = request.headers.get('cookie') ?? '';
  for (const cookie of cookies.split(';')) {
    const [key, ...parts] = cookie.trim().split('=');
    if (key === name) return decodeURIComponent(parts.join('='));
  }
  return '';
}

export function hasAccess(request: Request, slug: string, access: RankingAccess) {
  if (access.accessMode === 'public' || access.isOwner) return true;
  return Boolean(access.accessToken) && cookieValue(request, accessCookieName(slug)) === access.accessToken;
}

export function accessCookie(request: Request, slug: string, token: string) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${accessCookieName(slug)}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`;
}
