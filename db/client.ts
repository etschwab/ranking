import postgres from 'postgres';

let sharedClient: ReturnType<typeof postgres> | null = null;

function connectionString() {
  const value = process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? process.env.POSTGRES_PRISMA_URL;
  if (!value) throw new Error('Supabase Postgres is not configured.');
  return value;
}

function sqlClient() {
  sharedClient ??= postgres(connectionString(), { prepare: false, max: 3, idle_timeout: 20, connect_timeout: 10 });
  return sharedClient;
}

function postgresQuery(query: string) {
  let parameter = 0;
  return query
    .replaceAll('?', () => `$${++parameter}`)
    .replace(/\bAS\s+([a-z][a-z0-9]*[A-Z][a-zA-Z0-9]*)/g, 'AS "$1"');
}

class PreparedStatement {
  constructor(readonly query: string, readonly parameters: unknown[] = []) {}

  bind(...parameters: unknown[]) {
    return new PreparedStatement(this.query, parameters);
  }

  execute<T>(client = sqlClient()) {
    return client.unsafe(postgresQuery(this.query), this.parameters as never[]) as unknown as Promise<T[]>;
  }

  async first<T>() {
    return (await this.execute<T>())[0] ?? null;
  }

  async all<T>() {
    return { results: await this.execute<T>() };
  }

  async run() {
    await this.execute();
    return { success: true };
  }
}

export const db = {
  prepare(query: string) {
    return new PreparedStatement(query);
  },
  async batch(statements: PreparedStatement[]) {
    return sqlClient().begin(async (transaction) => Promise.all(
      statements.map((statement) => transaction.unsafe(postgresQuery(statement.query), statement.parameters as never[])),
    ));
  },
};
