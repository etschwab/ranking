import { env } from 'cloudflare:workers';
import { ensureSchema, getRanking } from '@/db/rankings';

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const ranking = await getRanking(slug);
    if (!ranking) return Response.json({ error: 'Ranking nicht gefunden.' }, { status: 404 });
    const body = await request.json() as { voterName?: unknown; scores?: unknown };
    const scores = body.scores && typeof body.scores === 'object' ? body.scores as Record<string, unknown> : {};
    const itemIds = new Set(ranking.items.map((item) => item.id));
    const entries = Object.entries(scores).filter(([itemId, tier]) => itemIds.has(itemId) && Number.isInteger(tier) && Number(tier) >= 1 && Number(tier) <= 5);
    if (entries.length !== ranking.items.length) return Response.json({ error: 'Bitte ordne jede Option einer Stufe zu.' }, { status: 400 });
    await ensureSchema();
    const db = env.DB;
    const ballotId = crypto.randomUUID();
    const voterName = typeof body.voterName === 'string' ? body.voterName.trim().slice(0, 50) : '';
    await db.batch([
      db.prepare('INSERT INTO ballots (id, ranking_id, voter_name, created_at) VALUES (?, ?, ?, ?)').bind(ballotId, ranking.id, voterName, Date.now()),
      ...entries.map(([itemId, tier]) => db.prepare('INSERT INTO scores (ballot_id, item_id, tier) VALUES (?, ?, ?)').bind(ballotId, itemId, Number(tier))),
    ]);
    return Response.json({ ok: true }, { status: 201 });
  } catch { return Response.json({ error: 'Deine Abstimmung konnte nicht gespeichert werden.' }, { status: 500 }); }
}
