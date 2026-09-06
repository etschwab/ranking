import { db } from '@/db/client';
import { ensureSchema } from '@/db/rankings';
import type { ReactionEmoji, ReactionTargetType } from '@/lib/reactions';

export type ReactionSummary = {
  emoji: ReactionEmoji;
  count: number;
  reacted: boolean;
};
export type RankingComment = {
  id: string;
  authorName: string;
  body: string;
  createdAt: number;
  reactions: ReactionSummary[];
  replies: RankingComment[];
};
export type RankingSocial = {
  itemReactions: Record<string, ReactionSummary[]>;
  comments: RankingComment[];
};

type ReactionRow = {
  targetType: ReactionTargetType;
  targetId: string;
  emoji: ReactionEmoji;
  count: number;
  reacted: number | boolean;
};

function summary(row: ReactionRow): ReactionSummary {
  return {
    emoji: row.emoji,
    count: Number(row.count),
    reacted: row.reacted === true || Number(row.reacted) > 0,
  };
}

export type CommentRow = {
  id: string;
  parentId: string | null;
  authorName: string;
  body: string;
  createdAt: number;
};

/**
 * Nests replies under their parent comment. `rows` must be sorted oldest-first
 * so that, once grouped, each thread's replies are already in chronological
 * order - only the top-level threads get flipped to newest-first for display.
 * A reply whose parent isn't found (deleted, or outside the fetched window)
 * falls back to being shown as a top-level comment rather than disappearing.
 */
export function buildCommentTree(
  rows: CommentRow[],
  reactionsByTarget: Map<string, ReactionSummary[]>,
): RankingComment[] {
  const byId = new Map<string, RankingComment>();
  const topLevel: RankingComment[] = [];
  for (const row of rows) {
    const comment: RankingComment = {
      id: row.id,
      authorName: row.authorName,
      body: row.body,
      createdAt: Number(row.createdAt),
      reactions: reactionsByTarget.get(`comment:${row.id}`) ?? [],
      replies: [],
    };
    byId.set(comment.id, comment);
    const parent = row.parentId ? byId.get(row.parentId) : undefined;
    if (parent) parent.replies.push(comment);
    else topLevel.push(comment);
  }
  return topLevel.reverse();
}

export async function getRankingSocial(
  slug: string,
  viewerId?: string,
): Promise<RankingSocial | null> {
  await ensureSchema();
  const ranking = await db
    .prepare('SELECT id FROM rankings WHERE slug = ?')
    .bind(slug)
    .first<{ id: string }>();
  if (!ranking) return null;
  const [commentRows, reactionRows] = await Promise.all([
    db
      .prepare(
        'SELECT id, parent_id AS parentId, author_name AS authorName, body, created_at AS createdAt FROM comments WHERE ranking_id = ? ORDER BY created_at ASC LIMIT 500',
      )
      .bind(ranking.id)
      .all<CommentRow>(),
    db
      .prepare(`
      SELECT target_type AS targetType, target_id AS targetId, emoji, COUNT(*) AS count,
        CASE WHEN SUM(CASE WHEN user_id = ? THEN 1 ELSE 0 END) > 0 THEN 1 ELSE 0 END AS reacted
      FROM reactions
      WHERE ranking_id = ?
      GROUP BY target_type, target_id, emoji
    `)
      .bind(viewerId ?? '', ranking.id)
      .all<ReactionRow>(),
  ]);

  const grouped = new Map<string, ReactionSummary[]>();
  for (const row of reactionRows.results) {
    const key = `${row.targetType}:${row.targetId}`;
    grouped.set(key, [...(grouped.get(key) ?? []), summary(row)]);
  }

  const itemReactions = Object.fromEntries(
    [...grouped.entries()]
      .filter(([key]) => key.startsWith('item:'))
      .map(([key, value]) => [key.slice(5), value]),
  );
  return {
    itemReactions,
    comments: buildCommentTree(commentRows.results, grouped),
  };
}

export async function addRankingComment(
  slug: string,
  userId: string,
  authorName: string,
  body: string,
  parentId?: string,
) {
  await ensureSchema();
  const ranking = await db
    .prepare('SELECT id FROM rankings WHERE slug = ?')
    .bind(slug)
    .first<{ id: string }>();
  if (!ranking) return null;
  let resolvedParentId: string | null = null;
  if (parentId) {
    const parent = await db
      .prepare(
        'SELECT id, parent_id AS parentId FROM comments WHERE id = ? AND ranking_id = ?',
      )
      .bind(parentId, ranking.id)
      .first<{ id: string; parentId: string | null }>();
    if (!parent) return 'invalid-parent' as const;
    // Flatten replies-to-replies onto the original thread's top-level comment
    // instead of nesting further.
    resolvedParentId = parent.parentId ?? parent.id;
  }
  const comment = {
    id: crypto.randomUUID(),
    rankingId: ranking.id,
    userId,
    authorName,
    body,
    parentId: resolvedParentId,
    createdAt: Date.now(),
  };
  await db
    .prepare(
      'INSERT INTO comments (id, ranking_id, user_id, author_name, body, created_at, parent_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(
      comment.id,
      comment.rankingId,
      comment.userId,
      comment.authorName,
      comment.body,
      comment.createdAt,
      comment.parentId,
    )
    .run();
  return comment.id;
}

export async function toggleRankingReaction(
  slug: string,
  targetType: ReactionTargetType,
  targetId: string,
  userId: string,
  emoji: ReactionEmoji,
) {
  await ensureSchema();
  const ranking = await db
    .prepare('SELECT id FROM rankings WHERE slug = ?')
    .bind(slug)
    .first<{ id: string }>();
  if (!ranking) return 'not-found' as const;
  const target =
    targetType === 'item'
      ? await db
          .prepare('SELECT id FROM items WHERE id = ? AND ranking_id = ?')
          .bind(targetId, ranking.id)
          .first<{ id: string }>()
      : await db
          .prepare('SELECT id FROM comments WHERE id = ? AND ranking_id = ?')
          .bind(targetId, ranking.id)
          .first<{ id: string }>();
  if (!target) return 'not-found' as const;
  const existing = await db
    .prepare(
      'SELECT id FROM reactions WHERE ranking_id = ? AND target_type = ? AND target_id = ? AND user_id = ? AND emoji = ?',
    )
    .bind(ranking.id, targetType, targetId, userId, emoji)
    .first<{ id: string }>();
  if (existing) {
    await db
      .prepare('DELETE FROM reactions WHERE id = ?')
      .bind(existing.id)
      .run();
    return 'removed' as const;
  }
  await db
    .prepare(
      'INSERT INTO reactions (id, ranking_id, target_type, target_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(
      crypto.randomUUID(),
      ranking.id,
      targetType,
      targetId,
      userId,
      emoji,
      Date.now(),
    )
    .run();
  return 'added' as const;
}
