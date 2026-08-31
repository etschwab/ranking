import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const rankings = sqliteTable('rankings', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  createdAt: integer('created_at').notNull(),
});

export const userProfiles = sqliteTable('user_profiles', {
  userId: text('user_id').primaryKey(),
  displayName: text('display_name').notNull(),
  email: text('email').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const rankingOwners = sqliteTable('ranking_owners', {
  rankingId: text('ranking_id').primaryKey().references(() => rankings.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  email: text('email').notNull(),
}, (table) => [index('idx_ranking_owners_user').on(table.userId)]);

export const items = sqliteTable('items', {
  id: text('id').primaryKey(),
  rankingId: text('ranking_id').notNull().references(() => rankings.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  position: integer('position').notNull(),
}, (table) => [index('idx_items_ranking_position').on(table.rankingId, table.position)]);

export const ballots = sqliteTable('ballots', {
  id: text('id').primaryKey(),
  rankingId: text('ranking_id').notNull().references(() => rankings.id, { onDelete: 'cascade' }),
  voterName: text('voter_name').notNull().default(''),
  createdAt: integer('created_at').notNull(),
}, (table) => [index('idx_ballots_ranking_created').on(table.rankingId, table.createdAt)]);

export const ballotEditTokens = sqliteTable('ballot_edit_tokens', {
  ballotId: text('ballot_id').primaryKey().references(() => ballots.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
});

export const scores = sqliteTable('scores', {
  ballotId: text('ballot_id').notNull().references(() => ballots.id, { onDelete: 'cascade' }),
  itemId: text('item_id').notNull().references(() => items.id, { onDelete: 'cascade' }),
  tier: integer('tier').notNull(),
}, (table) => [primaryKey({ columns: [table.ballotId, table.itemId] }), index('idx_scores_item').on(table.itemId)]);
