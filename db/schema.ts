import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';

export const rankings = sqliteTable('rankings', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  createdAt: integer('created_at').notNull(),
  isOpen: integer('is_open', { mode: 'boolean' }).notNull().default(true),
  closesAt: integer('closes_at'),
  accessMode: text('access_mode').notNull().default('public'),
  passwordHash: text('password_hash'),
  inviteToken: text('invite_token'),
  accessToken: text('access_token'),
  nameMode: text('name_mode').notNull().default('required'),
  oneVotePerUser: integer('one_vote_per_user', { mode: 'boolean' })
    .notNull()
    .default(true),
  resultsVisibility: text('results_visibility').notNull().default('always'),
  votePinHash: text('vote_pin_hash'),
  votePinToken: text('vote_pin_token'),
  previewImageData: text('preview_image_data'),
});

export const rankingTiers = sqliteTable(
  'ranking_tiers',
  {
    id: text('id').primaryKey(),
    rankingId: text('ranking_id')
      .notNull()
      .references(() => rankings.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    color: text('color').notNull(),
    position: integer('position').notNull(),
  },
  (table) => [
    index('idx_ranking_tiers_position').on(table.rankingId, table.position),
  ],
);

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  googleSub: text('google_sub').unique(),
  eschSub: text('esch_sub').unique(),
  displayName: text('display_name').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const authSessions = sqliteTable(
  'auth_sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: integer('expires_at').notNull(),
  },
  (table) => [
    index('idx_auth_sessions_user').on(table.userId),
    index('idx_auth_sessions_expires').on(table.expiresAt),
  ],
);

export const userProfiles = sqliteTable('user_profiles', {
  userId: text('user_id').primaryKey(),
  displayName: text('display_name').notNull(),
  email: text('email').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const rankingOwners = sqliteTable(
  'ranking_owners',
  {
    rankingId: text('ranking_id')
      .primaryKey()
      .references(() => rankings.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    email: text('email').notNull(),
  },
  (table) => [index('idx_ranking_owners_user').on(table.userId)],
);

export const items = sqliteTable(
  'items',
  {
    id: text('id').primaryKey(),
    rankingId: text('ranking_id')
      .notNull()
      .references(() => rankings.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    imageData: text('image_data'),
    position: integer('position').notNull(),
  },
  (table) => [
    index('idx_items_ranking_position').on(table.rankingId, table.position),
  ],
);

export const ballots = sqliteTable(
  'ballots',
  {
    id: text('id').primaryKey(),
    rankingId: text('ranking_id')
      .notNull()
      .references(() => rankings.id, { onDelete: 'cascade' }),
    voterName: text('voter_name').notNull().default(''),
    userId: text('user_id'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('idx_ballots_ranking_created').on(table.rankingId, table.createdAt),
    index('idx_ballots_ranking_user').on(table.rankingId, table.userId),
  ],
);

export const ballotEditTokens = sqliteTable('ballot_edit_tokens', {
  ballotId: text('ballot_id')
    .primaryKey()
    .references(() => ballots.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
});

export const scores = sqliteTable(
  'scores',
  {
    ballotId: text('ballot_id')
      .notNull()
      .references(() => ballots.id, { onDelete: 'cascade' }),
    itemId: text('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    tier: integer('tier').notNull(),
    rankPosition: integer('rank_position').notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.ballotId, table.itemId] }),
    index('idx_scores_item').on(table.itemId),
  ],
);
