import { env } from 'cloudflare:workers';
import { createSlug, ensureSchema } from '@/db/rankings';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { title?: unknown; description?: unknown; items?: unknown };
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 100) : '';
    const description = typeof body.description === 'string' ? body.description.trim().slice(0, 280) : '';
    const labels = Array.isArray(body.items) ? [...new Set(body.items.filter((value): value is string => typeof value === 'string').map((value) => value.trim()).filter(Boolean))].slice(0, 30) : [];
    if (title.length < 3) return Response.json({ error: 'Bitte gib einen Titel mit mindestens 3 Zeichen ein.' }, { status: 400 });
    if (labels.length < 2) return Response.json({ error: 'Bitte füge mindestens 2 unterschiedliche Optionen hinzu.' }, { status: 400 });
    await ensureSchema();
    const db = env.DB;
    const rankingId = crypto.randomUUID();
    const slug = createSlug();
    await db.batch([
      db.prepare('INSERT INTO rankings (id, slug, title, description, created_at) VALUES (?, ?, ?, ?, ?)').bind(rankingId, slug, title, description, Date.now()),
      ...labels.map((label, index) => db.prepare('INSERT INTO items (id, ranking_id, label, position) VALUES (?, ?, ?, ?)').bind(crypto.randomUUID(), rankingId, label.slice(0, 80), index)),
    ]);
    return Response.json({ slug }, { status: 201 });
  } catch { return Response.json({ error: 'Das Ranking konnte gerade nicht erstellt werden.' }, { status: 500 }); }
}
