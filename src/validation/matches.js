import { z } from "zod";

// ---------------------------------------------------------------------------
// Match status values, mirroring the `match_status` Postgres enum.
// Frozen so route/service layers cannot mutate the shared reference.
// ---------------------------------------------------------------------------
export const MATCH_STATUS = Object.freeze({
  SCHEDULED: "scheduled",
  LIVE: "live",
  FINISHED: "finished",
});

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------
const nonEmptyString = (field) =>
  z.string().trim().min(1, `${field} must be a non-empty string`);

// Accepts full ISO 8601 dates (`2026-09-03`) and datetimes
// (`2026-09-03T18:00:00Z`, `...+02:00`). The regex pins the shape while
// Date.parse rejects impossible calendar values (e.g. month 13).
const isoDatePattern =
  /^\d{4}-\d{2}-\d{2}(?:[Tt ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:[Zz]|[+-]\d{2}:?\d{2})?)?$/;

const isoDateString = (field) =>
  z
    .string()
    .refine(
      (value) => isoDatePattern.test(value) && !Number.isNaN(Date.parse(value)),
      { message: `${field} must be a valid ISO date string` },
    );

// Query/path params arrive as strings, so coerce before numeric checks.
const coercedPositiveInt = z.coerce.number().int().positive();
const coercedNonNegativeInt = z.coerce.number().int().min(0);

// ---------------------------------------------------------------------------
// GET /matches?limit=
// ---------------------------------------------------------------------------
export const listMatchesQuerySchema = z.object({
  limit: coercedPositiveInt.max(100).optional(),
});

// ---------------------------------------------------------------------------
// /matches/:id
// ---------------------------------------------------------------------------
export const matchIdParamSchema = z.object({
  id: coercedPositiveInt,
});

// ---------------------------------------------------------------------------
// POST /matches
// ---------------------------------------------------------------------------
export const createMatchSchema = z
  .object({
    sport: nonEmptyString("sport"),
    homeTeam: nonEmptyString("homeTeam"),
    awayTeam: nonEmptyString("awayTeam"),
    startTime: isoDateString("startTime"),
    endTime: isoDateString("endTime"),
    homeScore: coercedNonNegativeInt.optional(),
    awayScore: coercedNonNegativeInt.optional(),
  })
  .superRefine((data, ctx) => {
    // Field-level refinements already report malformed dates; NaN
    // comparisons are false, so this only fires on two valid dates.
    if (Date.parse(data.endTime) <= Date.parse(data.startTime)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endTime"],
        message: "endTime must be chronologically after startTime",
      });
    }
  });

// ---------------------------------------------------------------------------
// PATCH /matches/:id/score
// ---------------------------------------------------------------------------
export const updateScoreSchema = z.object({
  homeScore: coercedNonNegativeInt,
  awayScore: coercedNonNegativeInt,
});
