import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm/relations';

// ---------------------------------------------------------------------------
// Enum: match lifecycle
// 'scheduled' -> 'live' -> 'finished'. Transition driven by match service,
// broadcast over WebSocket so clients can subscribe/unsubscribe efficiently.
// ---------------------------------------------------------------------------
export const matchStatus = pgEnum('match_status', [
  'scheduled',
  'live',
  'finished',
]);

// ---------------------------------------------------------------------------
// Table: matches
// One row per fixture. Scores default to 0 so a newly-live match is valid
// without an explicit update. endTime stays NULL until the match finishes.
// ---------------------------------------------------------------------------
export const matches = pgTable(
  'matches',
  {
    id: serial('id').primaryKey(),
    sport: text('sport').notNull(),
    homeTeam: text('home_team').notNull(),
    awayTeam: text('away_team').notNull(),
    status: matchStatus('status').notNull().default('scheduled'),
    startTime: timestamp('start_time', { withTimezone: true }).notNull(),
    endTime: timestamp('end_time', { withTimezone: true }),
    homeScore: integer('home_score').notNull().default(0),
    awayScore: integer('away_score').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Hot paths: lobby filters by status, ordering/pagination by startTime.
    index('matches_status_idx').on(table.status),
    index('matches_start_time_idx').on(table.startTime),
  ],
);

// ---------------------------------------------------------------------------
// Table: commentary
// Append-only event feed per match, consumed in real time over WebSocket.
// Ordering rule: ORDER BY sequence ASC (minute is display-only and may be
// NULL for pre/post-match entries). The UNIQUE(match_id, sequence) guard
// makes client reconnects / producer retries idempotent.
// ---------------------------------------------------------------------------
export const commentary = pgTable(
  'commentary',
  {
    id: serial('id').primaryKey(),
    matchId: integer('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    minute: integer('minute'),
    sequence: integer('sequence').notNull(),
    period: text('period'),
    eventType: text('event_type').notNull(),
    actor: text('actor'),
    team: text('team'),
    message: text('message').notNull(),
    metadata: jsonb('metadata').notNull().default({}),
    tags: text('tags').array().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Lookup all events for a match + keyset pagination by sequence.
    index('commentary_match_id_idx').on(table.matchId),
    // Idempotent writes + deterministic live ordering per match.
    uniqueIndex('commentary_match_sequence_uidx').on(
      table.matchId,
      table.sequence,
    ),
    // Feed filtering, e.g. "goals only": WHERE match_id = ? AND event_type = ?
    index('commentary_match_event_idx').on(table.matchId, table.eventType),
  ],
);

// ---------------------------------------------------------------------------
// Relations (for `db.query.*` relational API)
// ---------------------------------------------------------------------------
export const matchesRelations = relations(matches, ({ many }) => ({
  commentary: many(commentary),
}));

export const commentaryRelations = relations(commentary, ({ one }) => ({
  match: one(matches, {
    fields: [commentary.matchId],
    references: [matches.id],
  }),
}));
