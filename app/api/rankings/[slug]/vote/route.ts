import { env } from 'cloudflare:workers';
import { ensureSchema, getRanking } from '@/db/rankings';

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const { slug } = await params;
  const token = new URL(request.url).searchParams.get('token')?.trim() ?? '';
  if (token.length < 20) return Response.json({ error: 'Ungültiger Bearbeitungslink.' }, { status: 400 });
  const ranking = await getRanking(slug);
  if (!ranking) return Response.json({ error: 'Ranking nicht gefunden.' }, { status: 404 });
  await ensureSchema();
  const ballot = await env.DB.prepare(`
    SELECT b.id, b.voter_name AS voterName
    FROM ballots b
    JOIN ballot_edit_tokens t ON t.ballot_id = b.id
    WHERE b.ranking_id = ? AND t.token = ?
  `).bind(ranking.id, token).first<{ id: string; voterName: string }>();
  if (!ballot) return Response.json({ error: 'Gespeicherte Abstimmung nicht gefunden.' }, { status: 404 });
  const rows = await env.DB.prepare('SELECT item_id AS itemId, tier FROM scores WHERE ballot_id = ?').bind(ballot.id).all<{ itemId: string; tier: number }>();
  return Response.json({ voterName: ballot.voterName, scores: Object.fromEntries(rows.results.map((row) => [row.itemId, Number(row.tier)])) });
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { slug } = await params;
    const ranking = await getRanking(slug);
    if (!ranking) return Response.json({ error: 'Ranking nicht gefunden.' }, { status: 404 });
    const body = await request.json() as { voterName?: unknown; scores?: unknown; editToken?: unknown };
    const scores = body.scores && typeof body.scores === 'object' ? body.scores as Record<string, unknown> : {};
    const itemIds = new Set(ranking.items.map((item) => item.id));
    const entries = Object.entries(scores).filter(([itemId, tier]) => itemIds.has(itemId) && Number.isInteger(tier) && Number(tier) >= 1 && Number(tier) <= 5);
    if (entries.length !== ranking.items.length) return Response.json({ error: 'Bitte ordne jede Option einer Stufe zu.' }, { status: 400 });
    await ensureSchema();
    const db = env.DB;
    const voterName = typeof body.voterName === 'string' ? body.voterName.trim().slice(0, 50) : '';
    const requestedToken = typeof body.editToken === 'string' ? body.editToken.trim() : '';

    if (requestedToken) {
      const existing = await db.prepare(`
        SELECT b.id FROM ballots b
        JOIN ballot_edit_tokens t ON t.ballot_id = b.id
        WHERE b.ranking_id = ? AND t.token = ?
      `).bind(ranking.id, requestedToken).first<{ id: string }>();
      if (!existing) return Response.json({ error: 'Diese Abstimmung kann nicht bearbeitet werden.' }, { status: 403 });
      await db.prepare('DELETE FROM scores WHERE ballot_id = ?').bind(existing.id).run();
      await db.batch([
        db.prepare('UPDATE ballots SET voter_name = ?, created_at = ? WHERE id = ?').bind(voterName, Date.now(), existing.id),
        ...entries.map(([itemId, tier]) => db.prepare('INSERT INTO scores (ballot_id, item_id, tier) VALUES (?, ?, ?)').bind(existing.id, itemId, Number(tier))),
      ]);
      return Response.json({ ok: true, editToken: requestedToken, updated: true });
    }

    const ballotId = crypto.randomUUID();
    const editToken = `${crypto.randomUUID()}${crypto.randomUUID()}`;
    await db.batch([
      db.prepare('INSERT INTO ballots (id, ranking_id, voter_name, created_at) VALUES (?, ?, ?, ?)').bind(ballotId, ranking.id, voterName, Date.now()),
      db.prepare('INSERT INTO ballot_edit_tokens (ballot_id, token) VALUES (?, ?)').bind(ballotId, editToken),
      ...entries.map(([itemId, tier]) => db.prepare('INSERT INTO scores (ballot_id, item_id, tier) VALUES (?, ?, ?)').bind(ballotId, itemId, Number(tier))),
    ]);
    return Response.json({ ok: true, editToken, updated: false }, { status: 201 });
  } catch {
    return Response.json({ error: 'Deine Abstimmung konnte nicht gespeichert werden.' }, { status: 500 });
  }
}
