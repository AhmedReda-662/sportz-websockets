import arcjet, { detectBot, shield, slidingWindow } from "@arcjet/node";

const arcjetKey = process.env.ARCJET_KEY;
const arcjetMode = process.env.ARCJET_MODE == "DRY_RUN" ? "DRY_RUN" : "LIVE";

if (!arcjetKey)
  throw new Error("ARCJET_KEY is not set in environment variables");

export const httpArcjet = arcjetKey
  ? new arcjet({
      key: arcjetKey,
      rules: [
        shield({
          mode: arcjetMode,
          action: "BLOCK",
          reason: "Arcjet Shielding",
        }),
        detectBot({
          mode: arcjetMode,
          action: "BLOCK",
          reason: "Arcjet Bot Detection",
          allow: ["CATEGORY:SEARCH_ENGINE", "CATEGORY:PREVIEW"],
        }),
        slidingWindow({ mode: arcjetMode, interval: "10s", max: 50 }),
      ],
    })
  : null;

export const wsArcjet = arcjetKey
  ? new arcjet({
      key: arcjetKey,
      rules: [
        shield({
          mode: arcjetMode,
          action: "BLOCK",
          reason: "Arcjet Shielding",
        }),
        detectBot({
          mode: arcjetMode,
          action: "BLOCK",
          reason: "Arcjet Bot Detection",
          allow: ["CATEGORY:SEARCH_ENGINE", "CATEGORY:PREVIEW"],
        }),
        slidingWindow({ mode: arcjetMode, interval: "2s", max: 5 }),
      ],
    })
  : null;

export function securityMiddleware() {
  return async (req, res, next) => {
    if (!httpArcjet) {
      return next();
    }
    try {
      const decision = await httpArcjet.protect(req);
      if (decision.isDenied()) {
        if (decision.reason.isRateLimit()) {
          return res.status(429).json({ error: "Too Many Requests" });
        }
        return res.status(403).json({ error: "Forbidden" });
      }
    } catch (e) {
      console.error("Error in security middleware:", e);
      return res.status(503).json({ error: "Service Unavailable" });
    }
    next();
  };
}
