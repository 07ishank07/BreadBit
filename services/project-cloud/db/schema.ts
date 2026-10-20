import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
export const projects = sqliteTable('projects', {
  owner: text('owner').notNull(), id: text('id').notNull(), name: text('name').notNull(), content: text('content').notNull(),
  etag: text('etag').notNull(), updatedAt: text('updated_at').notNull(), mutationId: text('mutation_id').notNull(),
}, table => [primaryKey({ columns: [table.owner, table.id] })]);
export const shares = sqliteTable('shares', {
  owner: text('owner').notNull(), projectId: text('project_id').notNull(), publicId: text('public_id').notNull().unique(), snapshot: text('snapshot').notNull(),
}, table => [primaryKey({ columns: [table.owner, table.projectId] })]);
export const sessions = sqliteTable('sessions', { tokenHash: text('token_hash').primaryKey(), owner: text('owner').notNull(), email: text('email').notNull(), expiresAt: integer('expires_at').notNull() });
export const pairings = sqliteTable('pairings', { deviceHash: text('device_hash').primaryKey(), userCode: text('user_code').notNull().unique(), expiresAt: integer('expires_at').notNull() });
export const pairLimits = sqliteTable('pair_limits', { id: text('id').primaryKey(), count: integer('count').notNull(), expiresAt: integer('expires_at').notNull() });
