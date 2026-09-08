import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { matchIdParamSchema } from "../validation/matches.js";
import {
  createCommentarySchema,
  listCommentaryQuerySchema,
} from "../validation/commentary.js";
import { db } from "../db/db.js";
import { commentary } from "../db/schema.js";

const MAX_LIMIT = 100;

export const router = Router({ mergeParams: true });

router.get("/", async (req, res) => {
  const parsedParams = matchIdParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({
      errors: "Invalid match id",
      details: parsedParams.error.issues,
    });
  }

  const parsedQuery = listCommentaryQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({
      errors: "Invalid query parameters",
      details: parsedQuery.error.issues,
    });
  }

  const limit = Math.min(parsedQuery.data.limit ?? 100, MAX_LIMIT);

  try {
    const rows = await db
      .select()
      .from(commentary)
      .where(eq(commentary.matchId, parsedParams.data.id))
      .orderBy(desc(commentary.createdAt))
      .limit(limit);

    return res.status(200).json({ data: rows });
  } catch (e) {
    return res.status(500).json({
      errors: "Failed to fetch commentary",
      details: JSON.stringify(e),
    });
  }
});

router.post("/", async (req, res) => {
  const parsedParams = matchIdParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({
      errors: "Invalid match id",
      details: parsedParams.error.issues,
    });
  }

  const parsedBody = createCommentarySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({
      errors: "Invalid payload",
      details: parsedBody.error.issues,
    });
  }

  try {
    const [entry] = await db
      .insert(commentary)
      .values({
        matchId: parsedParams.data.id,
        minute: parsedBody.data.minute ?? null,
        sequence: parsedBody.data.sequence,
        period: parsedBody.data.period ?? null,
        eventType: parsedBody.data.eventType,
        actor: parsedBody.data.actor ?? null,
        team: parsedBody.data.team ?? null,
        message: parsedBody.data.message,
        metadata: parsedBody.data.metadata ?? {},
        tags: parsedBody.data.tags ?? [],
      })
      .returning();

    if (res.app.locals.brodcastMatchCommentry) {
      res.app.locals.brodcastMatchCommentry(entry.matchId, entry);
    }
    return res
      .status(201)
      .json({ message: "Commentary created successfully", data: entry });
  } catch (e) {
    return res.status(500).json({
      errors: "Failed to create commentary",
      details: JSON.stringify(e),
    });
  }
});
