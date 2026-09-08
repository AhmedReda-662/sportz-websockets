import http from "http";
import express from "express";
import { router as matchesRouter } from "./route/matches.js";
import { router as commentaryRouter } from "./route/commentry.js";
import { attachWebSocketServer } from "./ws/server.js";
import { securityMiddleware } from "./arcjet.js";

const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || "0.0.0.0";
const app = express();
const server = http.createServer(app);
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello World");
});

// app.use(securityMiddleware());

app.use("/matches", matchesRouter);
app.use("/matches/:id/commentary", commentaryRouter);

const { broadcastMatchCreated, brodcastMatchCommentry } =
  attachWebSocketServer(server);

app.locals.broadcastMatchCreated = broadcastMatchCreated;
app.locals.brodcastMatchCommentry = brodcastMatchCommentry;

server.listen(PORT, HOST, () => {
  const baseURL =
    HOST === "0.0.0.0" ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;
  console.log(`Server is running on ${baseURL}`);
  console.log(
    `WebSocket server is running on ${baseURL.replace("http", "ws")}/ws`,
  );
});
