import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not defined');
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Background idle-client errors are emitted on the pool, not on queries.
// Without this listener Node treats 'error' as unhandled and crashes the
// long-running server, so log it here (the app's current reporting channel).
pool.on('error', (err) => {
  console.error('Unexpected idle client error on database pool:', err);
});

export const db = drizzle(pool, { schema });
