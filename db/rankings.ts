import { env } from 'cloudflare:workers';

export type RankingItem = { id: string; label: string; position: number; average: number | null; votes: number; distribution: Record<string, number> };
export type RankingData = { id: string; slug: string; title: string; description: string; createdAt: number; ballotCount: number; items: RankingItem[] };
export type EditableRankingItem = { id?: string; label: string };

let schemaReady = false;

export async function ensureSchema() {
  if (schemaReady) return;
  const db = env.DB;
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS rankings (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT \'\', created_at INTEGER NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, ranking_id TEXT NOT NULL REFERENCES rankings(id) ON DELETE CASCADE, label TEXT NOT NULL, position INTEGER NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS ballots (id TEXT PRIMARY KEY, ranking_id TEXT NOT NULL REFERENCES rankings(id) ON DELETE CASCADE, voter_name TEXT NOT NULL DEFAULT \'\', created_at INTEGER NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS ballot_edit_tokens (ballot_id TEXT PRIMARY KEY REFERENCES ballots(id) ON DELETE CASCADE, token TEXT NOT NULL UNIQUE)'),
    db.prepare('CREATE TABLE IF NOT EXISTS scores (ballot_id TEXT NOT NULL REFERENCES ballots(id) ON DELETE CASCADE, item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE, tier INTEGER NOT NULL CHECK(tier BETWEEN 1 AND 5), PRIMARY KEY (ballot_id, item_id))'),
    db.prepare('CREATE TABLE IF NOT EXISTS ranking_owners (ranking_id TEXT PRIMARY KEY REFERENCES rankings(id) ON DELETE CASCADE, user_id TEXT NOT NULL, email TEXT NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS user_profiles (user_id TEXT PRIMARY KEY, display_name TEXT NOT NULL, email TEXT NOT NULL, updated_at INTEGER NOT NULL)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_items_ranking_position ON items(ranking_id, position)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_ballots_ranking_created ON ballots(ranking_id, created_at)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_scores_item ON scores(item_id)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_ranking_owners_user ON ranking_owners(user_id)'),
  ]);
  schemaReady = true;
}

export async function getRankingsForOwner(userId: string) {
  await ensureSchema();
  const rows = await env.DB.prepare(`
    SELECT r.slug, r.title, r.description, r.created_at AS createdAt, COUNT(b.id) AS ballotCount
    FROM rankings r
    JOIN ranking_owners o ON o.ranking_id = r.id
    LEFT JOIN ballots b ON b.ranking_id = r.id
    WHERE o.user_id = ?
    GROUP BY r.id
    ORDER BY r.created_at DESC
  `).bind(userId).all<{ slug: string; title: string; description: string; createdAt: number; ballotCount: number }>();
  return rows.results.map((row) => ({ ...row, ballotCount: Number(row.ballotCount) }));
}

export async function getRanking(slug: string): Promise<RankingData | null> {
  await ensureSchema();
  const db = env.DB;
  const ranking = await db.prepare('SELECT id, slug, title, description, created_at AS createdAt FROM rankings WHERE slug = ?').bind(slug).first<{ id: string; slug: string; title: string; description: string; createdAt: number }>();
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
    ballotCount: Number(ballotRow?.count ?? 0),
    items: itemRows.results.map((item) => {
      const result = grouped.get(item.id);
      return { ...item, votes: result?.total ?? 0, average: result ? result.sum / result.total : null, distribution: result?.distribution ?? {} };
    }),
  };
}

export async function getOwnedRanking(slug: string, userId: string): Promise<RankingData | null> {
  await ensureSchema();
  const owned = await env.DB.prepare(`
    SELECT r.id
    FROM rankings r
    JOIN ranking_owners o ON o.ranking_id = r.id
    WHERE r.slug = ? AND o.user_id = ?
  `).bind(slug, userId).first<{ id: string }>();
  return owned ? getRanking(slug) : null;
}

export async function updateOwnedRanking(
  slug: string,
  userId: string,
  input: { title: string; description: string; items: EditableRankingItem[] },
) {
  await ensureSchema();
  const db = env.DB;
  const ranking = await db.prepare(`
    SELECT r.id
    FROM rankings r
    JOIN ranking_owners o ON o.ranking_id = r.id
    WHERE r.slug = ? AND o.user_id = ?
  `).bind(slug, userId).first<{ id: string }>();
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

  await db.batch([
    db.prepare('UPDATE rankings SET title = ?, description = ? WHERE id = ?').bind(input.title, input.description, ranking.id),
    deleteScores,
    deleteItems,
    ...input.items.map((item, position) => item.id && existingIds.has(item.id)
      ? db.prepare('UPDATE items SET label = ?, position = ? WHERE id = ? AND ranking_id = ?').bind(item.label, position, item.id, ranking.id)
      : db.prepare('INSERT INTO items (id, ranking_id, label, position) VALUES (?, ?, ?, ?)').bind(crypto.randomUUID(), ranking.id, item.label, position)),
  ]);
  return true;
}

export function createSlug() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}
