import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared primitives (mirrors src/validation/matches.js conventions)
// Query/body params may arrive as strings, so coerce before numeric checks.
// ---------------------------------------------------------------------------
const nonEmptyString = (field) =>
  z.string().trim().min(1, `${field} must be a non-empty string`);

const coercedPositiveInt = z.coerce.number().int().positive();
const coercedNonNegativeInt = z.coerce.number().int().min(0);

// ---------------------------------------------------------------------------
// GET /matches/:id/commentary?limit=
// ---------------------------------------------------------------------------
export const listCommentaryQuerySchema = z.object({
  limit: coercedPositiveInt.max(100).optional(),
});

// ---------------------------------------------------------------------------
// POST /matches/:id/commentary
// Mirrors the `commentary` table: minute is display-only and nullable,
// sequence drives ORDER BY + UNIQUE(match_id, sequence), message is the
// only required text payload, metadata/tags default to empty containers.
// ---------------------------------------------------------------------------
export const createCommentarySchema = z.object({
  minute: coercedNonNegativeInt.optional(),
  sequence: coercedNonNegativeInt,
  period: nonEmptyString("period").optional(),
  eventType: nonEmptyString("eventType"),
  actor: nonEmptyString("actor").optional(),
  team: nonEmptyString("team").optional(),
  message: nonEmptyString("message"),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
  tags: z.array(z.string()).optional().default([]),
});
