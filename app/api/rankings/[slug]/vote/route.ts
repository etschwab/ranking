import { ensureSchema, getRanking, type RankingData } from '@/db/rankings';
import { db } from '@/db/client';
import { getCurrentUser, signInPath } from '@/app/auth';
import { getUserProfile } from '@/db/profiles';
import {
  getRankingAccess,
  hasAccess,
  hasVotePinAccess,
} from '@/db/ranking-access';

type RouteContext = { params: Promise<{ slug: string }> };
type NormalizedEntry = readonly [
  itemId: string,
  tier: number,
  rankPosition: number,
];

export async function GET(request: Request, { params }: RouteContext) {
  const { slug } = await params;
  const user = await getCurrentUser();
  const access = await getRankingAccess(slug, user?.userId);
  if (!access)
    return Response.json({ error: 'Ranking nicht gefunden.' }, { status: 404 });
  if (!hasAccess(request, slug, access))
    return Response.json(
      { error: 'Dieses Ranking ist privat.', accessMode: access.accessMode },
      { status: 403 },
    );
  const token = new URL(request.url).searchParams.get('token')?.trim() ?? '';
  const ranking = await getRanking(slug);
  if (!ranking)
    return Response.json({ error: 'Ranking nicht gefunden.' }, { status: 404 });
  await ensureSchema();
  if (token.length < 20 && !(ranking.oneVotePerUser && user))
    return Response.json(
      { error: 'Ungültiger Bearbeitungslink.' },
      { status: 400 },
    );
  const ballot =
    token.length >= 20
      ? await db
          .prepare(
            'SELECT b.id, b.voter_name AS voterName FROM ballots b JOIN ballot_edit_tokens t ON t.ballot_id = b.id WHERE b.ranking_id = ? AND t.token = ?',
          )
          .bind(ranking.id, token)
          .first<{ id: string; voterName: string }>()
      : await db
          .prepare(
            'SELECT id, voter_name AS voterName FROM ballots WHERE ranking_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1',
          )
          .bind(ranking.id, user!.userId)
          .first<{ id: string; voterName: string }>();
  if (!ballot)
    return Response.json(
      { error: 'Gespeicherte Abstimmung nicht gefunden.' },
      { status: 404 },
    );
  const rows = await db
    .prepare(
      'SELECT item_id AS itemId, tier, rank_position AS rankPosition FROM scores WHERE ballot_id = ?',
    )
    .bind(ballot.id)
    .all<{ itemId: string; tier: number; rankPosition: number }>();
  return Response.json({
    voterName: ballot.voterName,
    scores: Object.fromEntries(
      rows.results.map((row) => [row.itemId, Number(row.tier)]),
    ),
    orders: Object.fromEntries(
      rows.results.map((row) => [row.itemId, Number(row.rankPosition)]),
    ),
  });
}

export async function POST(request: Request, { params }: RouteContext) {
  const { slug } = await params;
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json(
        {
          error: 'Bitte melde dich zuerst an.',
          signInPath: signInPath(`/r/${slug}`),
        },
        { status: 401 },
      );
    }

    const access = await getRankingAccess(slug, user.userId);
    if (!access)
      return Response.json(
        { error: 'Ranking nicht gefunden.' },
        { status: 404 },
      );
    if (!hasAccess(request, slug, access))
      return Response.json(
        { error: 'Dieses Ranking ist privat.', accessMode: access.accessMode },
        { status: 403 },
      );
    if (!hasVotePinAccess(request, slug, access))
      return Response.json(
        {
          error: 'Bitte gib zuerst die Abstimmungs-PIN ein.',
          pinRequired: true,
        },
        { status: 403 },
      );

    const ranking = await getRanking(slug);
    if (!ranking)
      return Response.json(
        { error: 'Ranking nicht gefunden.' },
        { status: 404 },
      );
    if (
      !ranking.isOpen ||
      (ranking.closesAt !== null && Date.now() >= ranking.closesAt)
    ) {
      return Response.json(
        { error: 'Diese Abstimmung ist bereits geschlossen.' },
        { status: 409 },
      );
    }

    const body = (await request.json()) as {
      scores?: unknown;
      orders?: unknown;
      editToken?: unknown;
    };
    const normalizedEntries = normalizeBallotEntries(ranking, body);
    if (!normalizedEntries)
      return Response.json(
        { error: 'Bitte ordne jede Option einer Stufe zu.' },
        { status: 400 },
      );

    await ensureSchema();
    const voterName =
      ranking.nameMode === 'required'
        ? ((await getUserProfile(user))?.displayName ?? 'Anonym')
        : 'Anonym';
    const requestedToken =
      typeof body.editToken === 'string' ? body.editToken.trim() : '';

    const result = await upsertBallot({
      ranking,
      userId: user.userId,
      voterName,
      requestedToken,
      normalizedEntries,
    });
    if (!result)
      return Response.json(
        { error: 'Diese Abstimmung kann nicht bearbeitet werden.' },
        { status: 403 },
      );
    return Response.json(
      { ok: true, editToken: result.editToken, updated: result.updated },
      { status: result.updated ? 200 : 201 },
    );
  } catch (error) {
    console.error(`Failed to save vote for ranking "${slug}"`, error);
    return Response.json(
      { error: 'Deine Abstimmung konnte nicht gespeichert werden.' },
      { status: 500 },
    );
  }
}

/** Validates and normalizes the submitted scores, computing a stable rank position within each tier. Returns null if any item is missing or invalid. */
function normalizeBallotEntries(
  ranking: RankingData,
  body: { scores?: unknown; orders?: unknown },
): NormalizedEntry[] | null {
  const scores =
    body.scores && typeof body.scores === 'object'
      ? (body.scores as Record<string, unknown>)
      : {};
  const orders =
    body.orders && typeof body.orders === 'object'
      ? (body.orders as Record<string, unknown>)
      : {};

  const itemIds = new Set(ranking.items.map((item) => item.id));
  const entries = Object.entries(scores).filter(
    ([itemId, tier]) =>
      itemIds.has(itemId) &&
      Number.isInteger(tier) &&
      Number(tier) >= 1 &&
      Number(tier) <= ranking.tiers.length,
  );
  if (entries.length !== ranking.items.length) return null;

  const itemPositions = new Map(
    ranking.items.map((item) => [item.id, item.position]),
  );
  const orderedEntries = entries.map(([itemId, tier]) => ({
    itemId,
    tier: Number(tier),
    requestedOrder:
      Number.isInteger(orders[itemId]) && Number(orders[itemId]) >= 0
        ? Number(orders[itemId])
        : 0,
  }));

  return orderedEntries.map((entry) => {
    const rankPosition = orderedEntries
      .filter((candidate) => candidate.tier === entry.tier)
      .sort(
        (a, b) =>
          a.requestedOrder - b.requestedOrder ||
          (itemPositions.get(a.itemId) ?? 0) -
            (itemPositions.get(b.itemId) ?? 0),
      )
      .findIndex((candidate) => candidate.itemId === entry.itemId);
    return [entry.itemId, entry.tier, rankPosition] as const;
  });
}

/** Finds the ballot a resubmission should overwrite: the user's existing ballot when one-vote-per-user is enforced, or the ballot matching a supplied edit token. */
async function findExistingBallotId(
  ranking: RankingData,
  userId: string,
  requestedToken: string,
): Promise<string | null> {
  if (ranking.oneVotePerUser) {
    const existing = await db
      .prepare(
        'SELECT id FROM ballots WHERE ranking_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1',
      )
      .bind(ranking.id, userId)
      .first<{ id: string }>();
    if (existing) return existing.id;
  }
  if (requestedToken) {
    const existing = await db
      .prepare(`
      SELECT b.id FROM ballots b
      JOIN ballot_edit_tokens t ON t.ballot_id = b.id
      WHERE b.ranking_id = ? AND t.token = ?
    `)
      .bind(ranking.id, requestedToken)
      .first<{ id: string }>();
    return existing?.id ?? null;
  }
  return null;
}

/** Replaces the scores of an existing ballot in place, keeping its original edit token. */
async function overwriteBallot(
  ballotId: string,
  userId: string,
  voterName: string,
  normalizedEntries: NormalizedEntry[],
) {
  const tokenRow = await db
    .prepare('SELECT token FROM ballot_edit_tokens WHERE ballot_id = ?')
    .bind(ballotId)
    .first<{ token: string }>();
  await db
    .prepare('DELETE FROM scores WHERE ballot_id = ?')
    .bind(ballotId)
    .run();
  await db.batch([
    db
      .prepare(
        'UPDATE ballots SET voter_name = ?, user_id = ?, created_at = ? WHERE id = ?',
      )
      .bind(voterName, userId, Date.now(), ballotId),
    ...normalizedEntries.map(([itemId, tier, rankPosition]) =>
      db
        .prepare(
          'INSERT INTO scores (ballot_id, item_id, tier, rank_position) VALUES (?, ?, ?, ?)',
        )
        .bind(ballotId, itemId, tier, rankPosition),
    ),
  ]);
  return tokenRow?.token ?? null;
}

/** Creates a brand-new ballot with its own edit token. */
async function insertBallot(
  rankingId: string,
  userId: string,
  voterName: string,
  normalizedEntries: NormalizedEntry[],
) {
  const ballotId = crypto.randomUUID();
  const editToken = `${crypto.randomUUID()}${crypto.randomUUID()}`;
  await db.batch([
    db
      .prepare(
        'INSERT INTO ballots (id, ranking_id, voter_name, user_id, created_at) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(ballotId, rankingId, voterName, userId, Date.now()),
    db
      .prepare(
        'INSERT INTO ballot_edit_tokens (ballot_id, token) VALUES (?, ?)',
      )
      .bind(ballotId, editToken),
    ...normalizedEntries.map(([itemId, tier, rankPosition]) =>
      db
        .prepare(
          'INSERT INTO scores (ballot_id, item_id, tier, rank_position) VALUES (?, ?, ?, ?)',
        )
        .bind(ballotId, itemId, tier, rankPosition),
    ),
  ]);
  return editToken;
}

type UpsertBallotArgs = {
  ranking: RankingData;
  userId: string;
  voterName: string;
  requestedToken: string;
  normalizedEntries: NormalizedEntry[];
};

/**
 * Saves a ballot: overwrites the caller's existing ballot when one-vote-per-user applies or a
 * valid edit token was supplied, otherwise inserts a new ballot. Returns null when an edit token
 * was supplied but doesn't match any ballot for this ranking.
 */
async function upsertBallot({
  ranking,
  userId,
  voterName,
  requestedToken,
  normalizedEntries,
}: UpsertBallotArgs) {
  const existingBallotId = await findExistingBallotId(
    ranking,
    userId,
    requestedToken,
  );

  if (existingBallotId) {
    const editToken = await overwriteBallot(
      existingBallotId,
      userId,
      voterName,
      normalizedEntries,
    );
    return { editToken: editToken ?? requestedToken, updated: true };
  }

  if (requestedToken) return null;

  const editToken = await insertBallot(
    ranking.id,
    userId,
    voterName,
    normalizedEntries,
  );
  return { editToken, updated: false };
}
