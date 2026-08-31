import { db } from '@/db/client';

export type RankingItem = { id: string; label: string; position: number; average: number | null; votes: number; distribution: Record<string, number> };
export type RankingData = { id: string; slug: string; title: string; description: string; createdAt: number; closesAt: number | null; ballotCount: number; items: RankingItem[] };
export type RankingAccessMode = 'public' | 'password' | 'invite';
export type OwnedRankingData = RankingData & { accessMode: RankingAccessMode; hasPassword: boolean; inviteToken: string | null };
export type EditableRankingItem = { id?: string; label: string };

let schemaReady = false;

export async function ensureSchema() {
  if (schemaReady) return;
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS rankings (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT \'\', created_at BIGINT NOT NULL, closes_at BIGINT, access_mode TEXT NOT NULL DEFAULT \'public\', password_hash TEXT, invite_token TEXT, access_token TEXT)'),
    db.prepare('CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, ranking_id TEXT NOT NULL REFERENCES rankings(id) ON DELETE CASCADE, label TEXT NOT NULL, position INTEGER NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS ballots (id TEXT PRIMARY KEY, ranking_id TEXT NOT NULL REFERENCES rankings(id) ON DELETE CASCADE, voter_name TEXT NOT NULL DEFAULT \'\', created_at BIGINT NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS ballot_edit_tokens (ballot_id TEXT PRIMARY KEY REFERENCES ballots(id) ON DELETE CASCADE, token TEXT NOT NULL UNIQUE)'),
    db.prepare('CREATE TABLE IF NOT EXISTS scores (ballot_id TEXT NOT NULL REFERENCES ballots(id) ON DELETE CASCADE, item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE, tier INTEGER NOT NULL CHECK(tier BETWEEN 1 AND 5), PRIMARY KEY (ballot_id, item_id))'),
    db.prepare('CREATE TABLE IF NOT EXISTS ranking_owners (ranking_id TEXT PRIMARY KEY REFERENCES rankings(id) ON DELETE CASCADE, user_id TEXT NOT NULL, email TEXT NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS user_profiles (user_id TEXT PRIMARY KEY, display_name TEXT NOT NULL, email TEXT NOT NULL, updated_at BIGINT NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS comments (id TEXT PRIMARY KEY, ranking_id TEXT NOT NULL REFERENCES rankings(id) ON DELETE CASCADE, user_id TEXT NOT NULL, author_name TEXT NOT NULL, body TEXT NOT NULL, created_at BIGINT NOT NULL)'),
    db.prepare("CREATE TABLE IF NOT EXISTS reactions (id TEXT PRIMARY KEY, ranking_id TEXT NOT NULL REFERENCES rankings(id) ON DELETE CASCADE, target_type TEXT NOT NULL CHECK(target_type IN ('item', 'comment')), target_id TEXT NOT NULL, user_id TEXT NOT NULL, emoji TEXT NOT NULL, created_at BIGINT NOT NULL)"),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_items_ranking_position ON items(ranking_id, position)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_ballots_ranking_created ON ballots(ranking_id, created_at)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_scores_item ON scores(item_id)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_ranking_owners_user ON ranking_owners(user_id)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_comments_ranking_created ON comments(ranking_id, created_at)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_reactions_target ON reactions(ranking_id, target_type, target_id)'),
    db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_reactions_unique ON reactions(ranking_id, target_type, target_id, user_id, emoji)'),
  ]);
  await db.batch([
    db.prepare('ALTER TABLE rankings ADD COLUMN IF NOT EXISTS closes_at BIGINT'),
    db.prepare("ALTER TABLE rankings ADD COLUMN IF NOT EXISTS access_mode TEXT NOT NULL DEFAULT 'public'"),
    db.prepare('ALTER TABLE rankings ADD COLUMN IF NOT EXISTS password_hash TEXT'),
    db.prepare('ALTER TABLE rankings ADD COLUMN IF NOT EXISTS invite_token TEXT'),
    db.prepare('ALTER TABLE rankings ADD COLUMN IF NOT EXISTS access_token TEXT'),
    db.prepare('ALTER TABLE rankings ALTER COLUMN created_at TYPE BIGINT'),
    db.prepare('ALTER TABLE rankings ALTER COLUMN closes_at TYPE BIGINT'),
    db.prepare('ALTER TABLE ballots ALTER COLUMN created_at TYPE BIGINT'),
    db.prepare('ALTER TABLE user_profiles ALTER COLUMN updated_at TYPE BIGINT'),
    db.prepare('ALTER TABLE comments ALTER COLUMN created_at TYPE BIGINT'),
    db.prepare('ALTER TABLE reactions ALTER COLUMN created_at TYPE BIGINT'),
  ]);
  schemaReady = true;
}

export async function getRankingsForOwner(userId: string) {
  await ensureSchema();
  const rows = await db.prepare(`
    SELECT r.slug, r.title, r.description, r.created_at AS createdAt, r.closes_at AS closesAt,
      r.access_mode AS accessMode, r.invite_token AS inviteToken, COUNT(b.id) AS ballotCount
    FROM rankings r
    JOIN ranking_owners o ON o.ranking_id = r.id
    LEFT JOIN ballots b ON b.ranking_id = r.id
    WHERE o.user_id = ?
    GROUP BY r.id
    ORDER BY r.created_at DESC
  `).bind(userId).all<{ slug: string; title: string; description: string; createdAt: number; closesAt: number | null; accessMode: RankingAccessMode; inviteToken: string | null; ballotCount: number }>();
  return rows.results.map((row) => ({ ...row, closesAt: row.closesAt === null ? null : Number(row.closesAt), ballotCount: Number(row.ballotCount) }));
}

export async function getRanking(slug: string): Promise<RankingData | null> {
  await ensureSchema();
  const ranking = await db.prepare('SELECT id, slug, title, description, created_at AS createdAt, closes_at AS closesAt FROM rankings WHERE slug = ?').bind(slug).first<{ id: string; slug: string; title: string; description: string; createdAt: number; closesAt: number | null }>();
  if (!ranking) return null;
  const [itemRows, ballotRow, scoreRows] = await Promise.all([
    db.prepare('SELECT id, label, position FROM items WHERE ranking_id = ? ORDER BY position').bind(ranking.id).all<{ id: string; label: string; position: number }>(),
    db.prepare('SELECT COUNT(*) AS count FROM ballots WHERE ranking_id = ?').bind(ranking.id).first<{ count: number }>(),
    db.prepare('SELECT s.item_id AS itemId, s.tier AS tier, COUNT(*) AS count FROM scores s JOIN items i ON i.id = s.item_id WHERE i.ranking_id = ? GROUP BY s.item_id, s.tier').bind(ranking.id).all<{ itemId: string; tier: number; count: number }>(),
  ]);
  const grouped = new Map<string, { total: number; sum: number; distribution: Record<string, number> }>();
  for (const row of scoreRows.results) {
    const current = grouped.get(row.itemId) ?? { total: 0, sum: 0, distribution: {} };
    current.total += Number(row.count);
    current.sum += Number(row.count) * Number(row.tier);
    current.distribution[String(row.tier)] = Number(row.count);
    grouped.set(row.itemId, current);
  }
  return {
    ...ranking,
    closesAt: ranking.closesAt === null ? null : Number(ranking.closesAt),
    ballotCount: Number(ballotRow?.count ?? 0),
    items: itemRows.results.map((item) => {
      const result = grouped.get(item.id);
      return { ...item, votes: result?.total ?? 0, average: result ? result.sum / result.total : null, distribution: result?.distribution ?? {} };
    }),
  };
}

export async function getOwnedRanking(slug: string, userId: string): Promise<OwnedRankingData | null> {
  await ensureSchema();
  const owned = await db.prepare(`
    SELECT r.id, r.access_mode AS accessMode, r.password_hash AS passwordHash, r.invite_token AS inviteToken
    FROM rankings r
    JOIN ranking_owners o ON o.ranking_id = r.id
    WHERE r.slug = ? AND o.user_id = ?
  `).bind(slug, userId).first<{ id: string; accessMode: RankingAccessMode; passwordHash: string | null; inviteToken: string | null }>();
  if (!owned) return null;
  const ranking = await getRanking(slug);
  return ranking ? { ...ranking, accessMode: owned.accessMode, hasPassword: Boolean(owned.passwordHash), inviteToken: owned.inviteToken } : null;
}

export async function updateOwnedRanking(
  slug: string,
  userId: string,
  input: { title: string; description: string; closesAt: number | null; accessMode: RankingAccessMode; passwordHash?: string; items: EditableRankingItem[] },
) {
  await ensureSchema();
  const ranking = await db.prepare(`
    SELECT r.id, r.access_mode AS accessMode, r.password_hash AS passwordHash, r.invite_token AS inviteToken, r.access_token AS accessToken
    FROM rankings r
    JOIN ranking_owners o ON o.ranking_id = r.id
    WHERE r.slug = ? AND o.user_id = ?
  `).bind(slug, userId).first<{ id: string; accessMode: RankingAccessMode; passwordHash: string | null; inviteToken: string | null; accessToken: string | null }>();
  if (!ranking) return false;

  const existingRows = await db.prepare('SELECT id FROM items WHERE ranking_id = ?').bind(ranking.id).all<{ id: string }>();
  const existingIds = new Set(existingRows.results.map((item) => item.id));
  const keptIds = input.items.flatMap((item) => item.id && existingIds.has(item.id) ? [item.id] : []);
  const placeholders = keptIds.map(() => '?').join(', ');
  const deleteScores = keptIds.length > 0
    ? db.prepare(`DELETE FROM scores WHERE item_id IN (SELECT id FROM items WHERE ranking_id = ? AND id NOT IN (${placeholders}))`).bind(ranking.id, ...keptIds)
    : db.prepare('DELETE FROM scores WHERE item_id IN (SELECT id FROM items WHERE ranking_id = ?)').bind(ranking.id);
  const deleteItems = keptIds.length > 0
    ? db.prepare(`DELETE FROM items WHERE ranking_id = ? AND id NOT IN (${placeholders})`).bind(ranking.id, ...keptIds)
    : db.prepare('DELETE FROM items WHERE ranking_id = ?').bind(ranking.id);

  const modeChanged = input.accessMode !== ranking.accessMode;
  const passwordChanged = input.accessMode === 'password' && input.passwordHash !== undefined;
  const passwordHash = input.accessMode === 'password' ? (input.passwordHash ?? ranking.passwordHash) : null;
  if (input.accessMode === 'password' && !passwordHash) return false;
  const inviteToken = input.accessMode === 'invite' ? (modeChanged ? createSecret() : ranking.inviteToken ?? createSecret()) : null;
  const accessToken = input.accessMode === 'public' ? null : (modeChanged || passwordChanged ? createSecret() : ranking.accessToken ?? createSecret());

  await db.batch([
    db.prepare('UPDATE rankings SET title = ?, description = ?, closes_at = ?, access_mode = ?, password_hash = ?, invite_token = ?, access_token = ? WHERE id = ?').bind(input.title, input.description, input.closesAt, input.accessMode, passwordHash, inviteToken, accessToken, ranking.id),
    deleteScores,
    deleteItems,
    ...input.items.map((item, position) => item.id && existingIds.has(item.id)
      ? db.prepare('UPDATE items SET label = ?, position = ? WHERE id = ? AND ranking_id = ?').bind(item.label, position, item.id, ranking.id)
      : db.prepare('INSERT INTO items (id, ranking_id, label, position) VALUES (?, ?, ?, ?)').bind(crypto.randomUUID(), ranking.id, item.label, position)),
  ]);
  return true;
}

export async function deleteOwnedRanking(slug: string, userId: string, confirmationTitle: string) {
  await ensureSchema();
  const ranking = await db.prepare(`
    SELECT r.id, r.title
    FROM rankings r
    JOIN ranking_owners o ON o.ranking_id = r.id
    WHERE r.slug = ? AND o.user_id = ?
  `).bind(slug, userId).first<{ id: string; title: string }>();
  if (!ranking) return 'not-owned' as const;
  if (confirmationTitle !== ranking.title) return 'title-mismatch' as const;

  await db.batch([
    db.prepare('DELETE FROM scores WHERE ballot_id IN (SELECT id FROM ballots WHERE ranking_id = ?) OR item_id IN (SELECT id FROM items WHERE ranking_id = ?)').bind(ranking.id, ranking.id),
    db.prepare('DELETE FROM ballot_edit_tokens WHERE ballot_id IN (SELECT id FROM ballots WHERE ranking_id = ?)').bind(ranking.id),
    db.prepare('DELETE FROM ballots WHERE ranking_id = ?').bind(ranking.id),
    db.prepare('DELETE FROM items WHERE ranking_id = ?').bind(ranking.id),
    db.prepare('DELETE FROM ranking_owners WHERE ranking_id = ?').bind(ranking.id),
    db.prepare('DELETE FROM rankings WHERE id = ?').bind(ranking.id),
  ]);
  return 'deleted' as const;
}

export function createSlug() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

export function createSecret() {
  return `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll('-', '');
}
