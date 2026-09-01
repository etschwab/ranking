import { db } from '@/db/client';

export type RankingTier = { id: string; label: string; color: string; position: number; score: number };
export type RankingItem = { id: string; label: string; imageData: string | null; position: number; average: number | null; averageRankPosition: number | null; votes: number; distribution: Record<string, number> };
export type RankingData = { id: string; slug: string; title: string; description: string; createdAt: number; isOpen: boolean; closesAt: number | null; ballotCount: number; tiers: RankingTier[]; items: RankingItem[] };
export type RankingAccessMode = 'public' | 'password' | 'invite';
export type OwnedRankingData = RankingData & { accessMode: RankingAccessMode; hasPassword: boolean; inviteToken: string | null };
export type EditableRankingItem = { id?: string; label: string; imageData?: string | null };
export type EditableRankingTier = { id?: string; label: string; color: string };

export const defaultTiers: EditableRankingTier[] = [
  { label: 'S', color: '#ff8b72' },
  { label: 'A', color: '#ffc56f' },
  { label: 'B', color: '#fff1a8' },
  { label: 'C', color: '#80d6a8' },
  { label: 'D', color: '#8dc5ff' },
];

let schemaReady = false;

export async function ensureSchema() {
  if (schemaReady) return;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS rankings (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', created_at BIGINT NOT NULL, is_open INTEGER NOT NULL DEFAULT 1, closes_at BIGINT, access_mode TEXT NOT NULL DEFAULT 'public', password_hash TEXT, invite_token TEXT, access_token TEXT)"),
    db.prepare('CREATE TABLE IF NOT EXISTS ranking_tiers (id TEXT PRIMARY KEY, ranking_id TEXT NOT NULL REFERENCES rankings(id) ON DELETE CASCADE, label TEXT NOT NULL, color TEXT NOT NULL, position INTEGER NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, ranking_id TEXT NOT NULL REFERENCES rankings(id) ON DELETE CASCADE, label TEXT NOT NULL, image_data TEXT, position INTEGER NOT NULL)'),
    db.prepare("CREATE TABLE IF NOT EXISTS ballots (id TEXT PRIMARY KEY, ranking_id TEXT NOT NULL REFERENCES rankings(id) ON DELETE CASCADE, voter_name TEXT NOT NULL DEFAULT '', created_at BIGINT NOT NULL)"),
    db.prepare('CREATE TABLE IF NOT EXISTS ballot_edit_tokens (ballot_id TEXT PRIMARY KEY REFERENCES ballots(id) ON DELETE CASCADE, token TEXT NOT NULL UNIQUE)'),
    db.prepare('CREATE TABLE IF NOT EXISTS scores (ballot_id TEXT NOT NULL REFERENCES ballots(id) ON DELETE CASCADE, item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE, tier INTEGER NOT NULL, rank_position INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (ballot_id, item_id))'),
    db.prepare('CREATE TABLE IF NOT EXISTS ranking_owners (ranking_id TEXT PRIMARY KEY REFERENCES rankings(id) ON DELETE CASCADE, user_id TEXT NOT NULL, email TEXT NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS user_profiles (user_id TEXT PRIMARY KEY, display_name TEXT NOT NULL, email TEXT NOT NULL, updated_at BIGINT NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS comments (id TEXT PRIMARY KEY, ranking_id TEXT NOT NULL REFERENCES rankings(id) ON DELETE CASCADE, user_id TEXT NOT NULL, author_name TEXT NOT NULL, body TEXT NOT NULL, created_at BIGINT NOT NULL)'),
    db.prepare("CREATE TABLE IF NOT EXISTS reactions (id TEXT PRIMARY KEY, ranking_id TEXT NOT NULL REFERENCES rankings(id) ON DELETE CASCADE, target_type TEXT NOT NULL CHECK(target_type IN ('item', 'comment')), target_id TEXT NOT NULL, user_id TEXT NOT NULL, emoji TEXT NOT NULL, created_at BIGINT NOT NULL)"),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_ranking_tiers_position ON ranking_tiers(ranking_id, position)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_items_ranking_position ON items(ranking_id, position)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_ballots_ranking_created ON ballots(ranking_id, created_at)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_scores_item ON scores(item_id)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_ranking_owners_user ON ranking_owners(user_id)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_comments_ranking_created ON comments(ranking_id, created_at)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_reactions_target ON reactions(ranking_id, target_type, target_id)'),
    db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_reactions_unique ON reactions(ranking_id, target_type, target_id, user_id, emoji)'),
  ]);
  await db.batch([
    db.prepare('ALTER TABLE rankings ADD COLUMN IF NOT EXISTS is_open INTEGER NOT NULL DEFAULT 1'),
    db.prepare('ALTER TABLE rankings ADD COLUMN IF NOT EXISTS closes_at BIGINT'),
    db.prepare("ALTER TABLE rankings ADD COLUMN IF NOT EXISTS access_mode TEXT NOT NULL DEFAULT 'public'"),
    db.prepare('ALTER TABLE rankings ADD COLUMN IF NOT EXISTS password_hash TEXT'),
    db.prepare('ALTER TABLE rankings ADD COLUMN IF NOT EXISTS invite_token TEXT'),
    db.prepare('ALTER TABLE rankings ADD COLUMN IF NOT EXISTS access_token TEXT'),
    db.prepare('ALTER TABLE items ADD COLUMN IF NOT EXISTS image_data TEXT'),
    db.prepare('ALTER TABLE scores ADD COLUMN IF NOT EXISTS rank_position INTEGER NOT NULL DEFAULT 0'),
    db.prepare('ALTER TABLE scores DROP CONSTRAINT IF EXISTS scores_tier_check'),
    db.prepare('ALTER TABLE rankings ALTER COLUMN created_at TYPE BIGINT'),
    db.prepare('ALTER TABLE rankings ALTER COLUMN closes_at TYPE BIGINT'),
    db.prepare('ALTER TABLE ballots ALTER COLUMN created_at TYPE BIGINT'),
    db.prepare('ALTER TABLE user_profiles ALTER COLUMN updated_at TYPE BIGINT'),
    db.prepare('ALTER TABLE comments ALTER COLUMN created_at TYPE BIGINT'),
    db.prepare('ALTER TABLE reactions ALTER COLUMN created_at TYPE BIGINT'),
  ]);
  await db.prepare(`
    INSERT INTO ranking_tiers (id, ranking_id, label, color, position)
    SELECT md5(r.id || '-tier-' || defaults.position::text), r.id, defaults.label, defaults.color, defaults.position
    FROM rankings r
    CROSS JOIN (VALUES (0, 'S', '#ff8b72'), (1, 'A', '#ffc56f'), (2, 'B', '#fff1a8'), (3, 'C', '#80d6a8'), (4, 'D', '#8dc5ff')) AS defaults(position, label, color)
    WHERE NOT EXISTS (SELECT 1 FROM ranking_tiers rt WHERE rt.ranking_id = r.id)
  `).run();
  schemaReady = true;
}

export async function getRankingsForOwner(userId: string) {
  await ensureSchema();
  const rows = await db.prepare(`
    SELECT r.slug, r.title, r.description, r.created_at AS createdAt, r.is_open AS isOpen, r.closes_at AS closesAt,
      r.access_mode AS accessMode, r.invite_token AS inviteToken, COUNT(b.id) AS ballotCount
    FROM rankings r JOIN ranking_owners o ON o.ranking_id = r.id LEFT JOIN ballots b ON b.ranking_id = r.id
    WHERE o.user_id = ? GROUP BY r.id ORDER BY r.created_at DESC
  `).bind(userId).all<{ slug: string; title: string; description: string; createdAt: number; isOpen: number; closesAt: number | null; accessMode: RankingAccessMode; inviteToken: string | null; ballotCount: number }>();
  return rows.results.map((row) => ({ ...row, isOpen: Boolean(row.isOpen), closesAt: row.closesAt === null ? null : Number(row.closesAt), ballotCount: Number(row.ballotCount) }));
}

export async function getRanking(slug: string): Promise<RankingData | null> {
  await ensureSchema();
  const ranking = await db.prepare('SELECT id, slug, title, description, created_at AS createdAt, is_open AS isOpen, closes_at AS closesAt FROM rankings WHERE slug = ?').bind(slug).first<{ id: string; slug: string; title: string; description: string; createdAt: number; isOpen: number; closesAt: number | null }>();
  if (!ranking) return null;
  const [tierRows, itemRows, ballotRow, scoreRows] = await Promise.all([
    db.prepare('SELECT id, label, color, position FROM ranking_tiers WHERE ranking_id = ? ORDER BY position').bind(ranking.id).all<{ id: string; label: string; color: string; position: number }>(),
    db.prepare('SELECT id, label, image_data AS imageData, position FROM items WHERE ranking_id = ? ORDER BY position').bind(ranking.id).all<{ id: string; label: string; imageData: string | null; position: number }>(),
    db.prepare('SELECT COUNT(*) AS count FROM ballots WHERE ranking_id = ?').bind(ranking.id).first<{ count: number }>(),
    db.prepare('SELECT s.item_id AS itemId, s.tier, COUNT(*) AS count, AVG(s.rank_position) AS averageRankPosition FROM scores s JOIN items i ON i.id = s.item_id WHERE i.ranking_id = ? GROUP BY s.item_id, s.tier').bind(ranking.id).all<{ itemId: string; tier: number; count: number; averageRankPosition: number }>(),
  ]);
  const tierCount = tierRows.results.length;
  const grouped = new Map<string, { total: number; sum: number; rankSum: number; distribution: Record<string, number> }>();
  for (const row of scoreRows.results) {
    const current = grouped.get(row.itemId) ?? { total: 0, sum: 0, rankSum: 0, distribution: {} };
    current.total += Number(row.count);
    current.sum += Number(row.count) * Number(row.tier);
    current.rankSum += Number(row.count) * Number(row.averageRankPosition);
    current.distribution[String(row.tier)] = Number(row.count);
    grouped.set(row.itemId, current);
  }
  return {
    ...ranking,
    isOpen: Boolean(ranking.isOpen),
    closesAt: ranking.closesAt === null ? null : Number(ranking.closesAt),
    ballotCount: Number(ballotRow?.count ?? 0),
    tiers: tierRows.results.map((tier) => ({ ...tier, score: tierCount - tier.position })),
    items: itemRows.results.map((item) => {
      const result = grouped.get(item.id);
      return { ...item, votes: result?.total ?? 0, average: result ? result.sum / result.total : null, averageRankPosition: result ? result.rankSum / result.total : null, distribution: result?.distribution ?? {} };
    }),
  };
}

export async function getOwnedRanking(slug: string, userId: string): Promise<OwnedRankingData | null> {
  await ensureSchema();
  const owned = await db.prepare(`SELECT r.id, r.access_mode AS accessMode, r.password_hash AS passwordHash, r.invite_token AS inviteToken FROM rankings r JOIN ranking_owners o ON o.ranking_id = r.id WHERE r.slug = ? AND o.user_id = ?`).bind(slug, userId).first<{ id: string; accessMode: RankingAccessMode; passwordHash: string | null; inviteToken: string | null }>();
  if (!owned) return null;
  const ranking = await getRanking(slug);
  return ranking ? { ...ranking, accessMode: owned.accessMode, hasPassword: Boolean(owned.passwordHash), inviteToken: owned.inviteToken } : null;
}

export async function updateOwnedRanking(slug: string, userId: string, input: { title: string; description: string; isOpen?: boolean; closesAt: number | null; accessMode: RankingAccessMode; passwordHash?: string; items: EditableRankingItem[]; tiers: EditableRankingTier[] }) {
  await ensureSchema();
  const ranking = await db.prepare(`SELECT r.id, r.is_open AS isOpen, r.access_mode AS accessMode, r.password_hash AS passwordHash, r.invite_token AS inviteToken, r.access_token AS accessToken FROM rankings r JOIN ranking_owners o ON o.ranking_id = r.id WHERE r.slug = ? AND o.user_id = ?`).bind(slug, userId).first<{ id: string; isOpen: number; accessMode: RankingAccessMode; passwordHash: string | null; inviteToken: string | null; accessToken: string | null }>();
  if (!ranking) return false;

  const [existingItems, existingTiers] = await Promise.all([
    db.prepare('SELECT id FROM items WHERE ranking_id = ?').bind(ranking.id).all<{ id: string }>(),
    db.prepare('SELECT id, position FROM ranking_tiers WHERE ranking_id = ? ORDER BY position').bind(ranking.id).all<{ id: string; position: number }>(),
  ]);
  const itemIds = new Set(existingItems.results.map((item) => item.id));
  const keptItems = input.items.flatMap((item) => item.id && itemIds.has(item.id) ? [item.id] : []);
  const itemPlaceholders = keptItems.map(() => '?').join(', ');
  const deleteScores = keptItems.length ? db.prepare(`DELETE FROM scores WHERE item_id IN (SELECT id FROM items WHERE ranking_id = ? AND id NOT IN (${itemPlaceholders}))`).bind(ranking.id, ...keptItems) : db.prepare('DELETE FROM scores WHERE item_id IN (SELECT id FROM items WHERE ranking_id = ?)').bind(ranking.id);
  const deleteItems = keptItems.length ? db.prepare(`DELETE FROM items WHERE ranking_id = ? AND id NOT IN (${itemPlaceholders})`).bind(ranking.id, ...keptItems) : db.prepare('DELETE FROM items WHERE ranking_id = ?').bind(ranking.id);

  const tierIds = new Set(existingTiers.results.map((tier) => tier.id));
  const keptTierIds = input.tiers.flatMap((tier) => tier.id && tierIds.has(tier.id) ? [tier.id] : []);
  const oldCount = existingTiers.results.length;
  const newCount = input.tiers.length;
  const tierUpdates = input.tiers.map((tier, position) => ({ ...tier, id: tier.id && tierIds.has(tier.id) ? tier.id : crypto.randomUUID(), position }));
  const scoreMappings = tierUpdates.flatMap((tier) => {
    if (!tier.id || !tierIds.has(tier.id)) return [];
    const oldTier = existingTiers.results.find((entry) => entry.id === tier.id)!;
    return [{ from: oldCount - oldTier.position, to: newCount - tier.position }];
  });
  const remapScores = scoreMappings.length ? db.prepare(`UPDATE scores SET tier = CASE tier ${scoreMappings.map((mapping) => `WHEN ${mapping.from} THEN ${mapping.to}`).join(' ')} ELSE tier END WHERE tier IN (${scoreMappings.map((mapping) => mapping.from).join(', ')}) AND item_id IN (SELECT id FROM items WHERE ranking_id = ?)`).bind(ranking.id) : null;
  const removedOldScores = existingTiers.results.flatMap((tier) => keptTierIds.includes(tier.id) ? [] : [db.prepare('DELETE FROM scores WHERE tier = ? AND item_id IN (SELECT id FROM items WHERE ranking_id = ?)').bind(oldCount - tier.position, ranking.id)]);

  const modeChanged = input.accessMode !== ranking.accessMode;
  const passwordChanged = input.accessMode === 'password' && input.passwordHash !== undefined;
  const passwordHash = input.accessMode === 'password' ? (input.passwordHash ?? ranking.passwordHash) : null;
  if (input.accessMode === 'password' && !passwordHash) return false;
  const inviteToken = input.accessMode === 'invite' ? (modeChanged ? createSecret() : ranking.inviteToken ?? createSecret()) : null;
  const accessToken = input.accessMode === 'public' ? null : (modeChanged || passwordChanged ? createSecret() : ranking.accessToken ?? createSecret());

  await db.batch([
    db.prepare('UPDATE rankings SET title = ?, description = ?, is_open = ?, closes_at = ?, access_mode = ?, password_hash = ?, invite_token = ?, access_token = ? WHERE id = ?').bind(input.title, input.description, (input.isOpen ?? Boolean(ranking.isOpen)) ? 1 : 0, input.closesAt, input.accessMode, passwordHash, inviteToken, accessToken, ranking.id),
    deleteScores,
    deleteItems,
    ...(remapScores ? [remapScores] : []),
    ...removedOldScores,
    ...existingTiers.results.flatMap((tier) => keptTierIds.includes(tier.id) ? [] : [db.prepare('DELETE FROM ranking_tiers WHERE id = ?').bind(tier.id)]),
    ...tierUpdates.map((tier) => tierIds.has(tier.id) ? db.prepare('UPDATE ranking_tiers SET label = ?, color = ?, position = ? WHERE id = ?').bind(tier.label, tier.color, tier.position, tier.id) : db.prepare('INSERT INTO ranking_tiers (id, ranking_id, label, color, position) VALUES (?, ?, ?, ?, ?)').bind(tier.id, ranking.id, tier.label, tier.color, tier.position)),
    ...input.items.map((item, position) => item.id && itemIds.has(item.id) ? db.prepare('UPDATE items SET label = ?, image_data = ?, position = ? WHERE id = ? AND ranking_id = ?').bind(item.label, item.imageData ?? null, position, item.id, ranking.id) : db.prepare('INSERT INTO items (id, ranking_id, label, image_data, position) VALUES (?, ?, ?, ?, ?)').bind(crypto.randomUUID(), ranking.id, item.label, item.imageData ?? null, position)),
  ]);
  return true;
}

export async function deleteOwnedRanking(slug: string, userId: string, confirmationTitle: string) {
  await ensureSchema();
  const ranking = await db.prepare('SELECT r.id, r.title FROM rankings r JOIN ranking_owners o ON o.ranking_id = r.id WHERE r.slug = ? AND o.user_id = ?').bind(slug, userId).first<{ id: string; title: string }>();
  if (!ranking) return 'not-owned' as const;
  if (confirmationTitle !== ranking.title) return 'title-mismatch' as const;
  await db.batch([
    db.prepare('DELETE FROM reactions WHERE ranking_id = ?').bind(ranking.id),
    db.prepare('DELETE FROM comments WHERE ranking_id = ?').bind(ranking.id),
    db.prepare('DELETE FROM scores WHERE ballot_id IN (SELECT id FROM ballots WHERE ranking_id = ?) OR item_id IN (SELECT id FROM items WHERE ranking_id = ?)').bind(ranking.id, ranking.id),
    db.prepare('DELETE FROM ballot_edit_tokens WHERE ballot_id IN (SELECT id FROM ballots WHERE ranking_id = ?)').bind(ranking.id),
    db.prepare('DELETE FROM ballots WHERE ranking_id = ?').bind(ranking.id),
    db.prepare('DELETE FROM items WHERE ranking_id = ?').bind(ranking.id),
    db.prepare('DELETE FROM ranking_tiers WHERE ranking_id = ?').bind(ranking.id),
    db.prepare('DELETE FROM ranking_owners WHERE ranking_id = ?').bind(ranking.id),
    db.prepare('DELETE FROM rankings WHERE id = ?').bind(ranking.id),
  ]);
  return 'deleted' as const;
}

export async function duplicateOwnedRanking(slug: string, userId: string, email: string) {
  await ensureSchema();
  const source = await db.prepare('SELECT r.id, r.title, r.description, r.access_mode AS accessMode, r.password_hash AS passwordHash FROM rankings r JOIN ranking_owners o ON o.ranking_id = r.id WHERE r.slug = ? AND o.user_id = ?').bind(slug, userId).first<{ id: string; title: string; description: string; accessMode: RankingAccessMode; passwordHash: string | null }>();
  if (!source) return null;
  const [sourceItems, sourceTiers] = await Promise.all([
    db.prepare('SELECT label, image_data AS imageData FROM items WHERE ranking_id = ? ORDER BY position').bind(source.id).all<{ label: string; imageData: string | null }>(),
    db.prepare('SELECT label, color FROM ranking_tiers WHERE ranking_id = ? ORDER BY position').bind(source.id).all<{ label: string; color: string }>(),
  ]);
  const rankingId = crypto.randomUUID();
  const duplicateSlug = createSlug();
  const inviteToken = source.accessMode === 'invite' ? createSecret() : null;
  const accessToken = source.accessMode === 'public' ? null : createSecret();
  await db.batch([
    db.prepare('INSERT INTO rankings (id, slug, title, description, created_at, is_open, closes_at, access_mode, password_hash, invite_token, access_token) VALUES (?, ?, ?, ?, ?, 1, NULL, ?, ?, ?, ?)').bind(rankingId, duplicateSlug, `${source.title} (Kopie)`.slice(0, 100), source.description, Date.now(), source.accessMode, source.passwordHash, inviteToken, accessToken),
    db.prepare('INSERT INTO ranking_owners (ranking_id, user_id, email) VALUES (?, ?, ?)').bind(rankingId, userId, email),
    ...sourceTiers.results.map((tier, position) => db.prepare('INSERT INTO ranking_tiers (id, ranking_id, label, color, position) VALUES (?, ?, ?, ?, ?)').bind(crypto.randomUUID(), rankingId, tier.label, tier.color, position)),
    ...sourceItems.results.map((item, position) => db.prepare('INSERT INTO items (id, ranking_id, label, image_data, position) VALUES (?, ?, ?, ?, ?)').bind(crypto.randomUUID(), rankingId, item.label, item.imageData, position)),
  ]);
  return duplicateSlug;
}

export function createSlug() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

export function createSecret() {
  return `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll('-', '');
}
