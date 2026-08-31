import { env } from 'cloudflare:workers';
import { createSlug, ensureSchema } from '@/db/rankings';
import { chatGPTSignInPath, getChatGPTUser } from '@/app/chatgpt-auth';

export async function POST(request: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: 'Bitte melde dich zuerst an.', signInPath: chatGPTSignInPath('/') }, { status: 401 });
    const body = await request.json() as { title?: unknown; description?: unknown; closesAt?: unknown; items?: unknown };
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 100) : '';
    const description = typeof body.description === 'string' ? body.description.trim().slice(0, 280) : '';
    const labels = Array.isArray(body.items) ? [...new Set(body.items.filter((value): value is string => typeof value === 'string').map((value) => value.trim()).filter(Boolean))].slice(0, 30) : [];
    const closesAt = typeof body.closesAt === 'number' && Number.isFinite(body.closesAt) ? Math.trunc(body.closesAt) : null;
    if (title.length < 3) return Response.json({ error: 'Bitte gib einen Titel mit mindestens 3 Zeichen ein.' }, { status: 400 });
    if (labels.length < 2) return Response.json({ error: 'Bitte füge mindestens 2 unterschiedliche Optionen hinzu.' }, { status: 400 });
    if (body.closesAt !== null && body.closesAt !== undefined && closesAt === null) return Response.json({ error: 'Die Abstimmungsfrist ist ungültig.' }, { status: 400 });
    if (closesAt !== null && closesAt <= Date.now()) return Response.json({ error: 'Die Abstimmungsfrist muss in der Zukunft liegen.' }, { status: 400 });
    await ensureSchema();
    const db = env.DB;
    const rankingId = crypto.randomUUID();
    const slug = createSlug();
    await db.batch([
      db.prepare('INSERT INTO rankings (id, slug, title, description, created_at, closes_at) VALUES (?, ?, ?, ?, ?, ?)').bind(rankingId, slug, title, description, Date.now(), closesAt),
      db.prepare('INSERT INTO ranking_owners (ranking_id, user_id, email) VALUES (?, ?, ?)').bind(rankingId, user.userId, user.email),
      ...labels.map((label, index) => db.prepare('INSERT INTO items (id, ranking_id, label, position) VALUES (?, ?, ?, ?)').bind(crypto.randomUUID(), rankingId, label.slice(0, 80), index)),
    ]);
    return Response.json({ slug }, { status: 201 });
  } catch { return Response.json({ error: 'Das Ranking konnte gerade nicht erstellt werden.' }, { status: 500 }); }
}
