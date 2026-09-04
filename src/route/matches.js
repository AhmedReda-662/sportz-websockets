import { Router } from "express";
import {
  createMatchSchema,
  listMatchesQuerySchema,
} from "../validation/matches.js";
import { db } from "../db/db.js";
import { matches } from "../db/schema.js";
import { getMatchStatus } from "../utils/match-status.js";

const MAX_LIMIT = 100;

export const router = Router();

router.get("/", async (req, res) => {
  const parsed = listMatchesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      errors: "Invalid query parameters",
      details: parsed.error.issues,
    });
  }
  const limit = Math.min(parsed.data.limit ?? 50, MAX_LIMIT);

  try {
    const matchesList = await db
      .select()
      .from(matches)
      .limit(limit)
      .orderBy(matches.createdAt, "desc");
    res.status(200).json({ data: matchesList });
  } catch (e) {
    res.status(500).json({
      errors: "Failed to fetch matches",
      details: JSON.stringify(e),
    });
  }
});

router.post("/", async (req, res) => {
  const parsed = createMatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      errors: "Invalid payload",
      details: parsed.error.issues,
    });
  }
  const {
    data: { startTime, endTime, homeScore, awayScore },
  } = parsed;
  try {
    const [event] = await db
      .insert(matches)
      .values({
        ...parsed.data,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        homeScore: homeScore ?? 0,
        awayScore: awayScore ?? 0,
        status: getMatchStatus(startTime, endTime),
      })
      .returning();

    res
      .status(201)
      .json({ message: "Match created successfully", data: event });
  } catch (e) {
    res.status(500).json({
      errors: "Failed to create match",
      details: JSON.stringify(e),
    });
  }
});
