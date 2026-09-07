# Rankly

Tier-List-Rankings für Gruppen: Optionen anlegen, per Link teilen, gemeinsam
abstimmen und live auswerten. Läuft auf [vinext](https://github.com/cloudflare/vinext)
(Next.js auf Vite) mit Cloudflare Workers als Zielplattform und Postgres als
Datenbank.

## Voraussetzungen

- Node.js ≥ 22.13 (siehe `engines` in [package.json](package.json))
- Eine Postgres-Datenbank (z. B. [Supabase](https://supabase.com))

## Setup

```bash
npm install
```

Lege eine `.env`-Datei im Projekt-Root an:

```bash
# Pflicht
POSTGRES_URL=postgres://user:password@host:5432/dbname
AUTH_SECRET=ein-langer-zufälliger-string

# Optional: SSO über eine eigene esch-auth/Supabase-Instanz.
# Nur nötig, wenn "Mit Google/SSO anmelden" statt der lokalen
# E-Mail/Passwort-Anmeldung genutzt werden soll. Alle vier müssen
# gemeinsam gesetzt sein, sonst fällt die App automatisch auf die
# lokale Anmeldung zurück (siehe lib/sso.ts).
NEXT_PUBLIC_AUTH_URL=https://auth.example.com
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_OAUTH_CLIENT_ID=...
SUPABASE_OAUTH_CLIENT_SECRET=...
```

`POSTGRES_URL` kann alternativ auch `DATABASE_URL` oder `POSTGRES_PRISMA_URL`
heißen (siehe [db/client.ts](db/client.ts)) – nimm, was deine Postgres-Hosting-
Plattform vorgibt.

Das Datenbankschema wird beim ersten Request automatisch angelegt/aktualisiert
(`ensureSchema()` in [db/rankings.ts](db/rankings.ts)) – es ist keine manuelle
Migration nötig.

## Entwicklung

```bash
npm run dev
```

## Scripts

| Befehl                 | Zweck                                |
| ---------------------- | ------------------------------------ |
| `npm run dev`          | Dev-Server starten                   |
| `npm run build`        | Production-Build                     |
| `npm run start`        | Gebauten Server via Wrangler starten |
| `npm run lint`         | oxlint                               |
| `npm run format`       | oxfmt (schreibt Änderungen)          |
| `npm run format:check` | oxfmt (nur prüfen, für CI)           |
| `npm run typecheck`    | `tsc --noEmit`                       |
| `npm run test`         | Unit-Tests (vitest)                  |

Bei jedem Push/PR laufen `lint`, `format:check`, `typecheck` und `test` über
[.github/workflows/ci.yml](.github/workflows/ci.yml).

## Projektstruktur

```
app/            Next.js App-Router-Seiten und API-Routen
components/     React-Komponenten (components/ui/* sind shadcn-Primitives)
db/             Datenbankzugriff (Postgres, siehe db/client.ts) und Schema
lib/            Framework-unabhängige Hilfsfunktionen (Passwörter, SSO, ...)
drizzle/        Drizzle-Schema-Snapshots (Referenz, siehe "Datenbank" unten)
```

### Datenbank

Das Projekt nutzt Drizzle ORM primär für die **Typdefinitionen**
([db/schema.ts](db/schema.ts)); die eigentlichen Tabellen werden zur Laufzeit
über rohes SQL in `ensureSchema()` angelegt und inkrementell erweitert
(`ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...`). `npm run db:generate`
erzeugt daraus lediglich Migrations-Snapshots unter `drizzle/` als
Dokumentation – sie werden nicht automatisch ausgeführt.
