import { WebSocket, WebSocketServer } from "ws";
import { wsArcjet } from "../arcjet.js";

function sendJSON(socket, payload) {
  if (socket.readyState !== WebSocket.OPEN) return;

  socket.send(JSON.stringify(payload));
}

function broadcastJSON(wss, payload) {
  const message = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState !== WebSocket.OPEN) continue;

    client.send(message);
  }
}

export function attachWebSocketServer(server) {
  const wss = new WebSocketServer({
    server,
    path: "/ws",
    maxPayload: 1024 * 1024,
  });

  wss.on("connection", async (ws, req) => {
    if (wsArcjet) {
      try {
        const decision = await wsArcjet.protect(req);
        if (decision.isDenied()) {
          const code = decision.reason.isRateLimit() ? 1013 : 1008;
          const reason = decision.reason.isRateLimit()
            ? "Rate limit exceeded"
            : "Forbidden";
          ws.close(code, reason);
          return;
        }
      } catch (e) {
        console.error("WS connection error:", e);
        ws.close(1011, "Internal server error");
        return;
      }
    }
    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });
    sendJSON(ws, {
      type: "welcome",
      message: "Welcome to the WebSocket server!",
    });
    ws.on("error", (err) => {
      console.error("WebSocket error:", err);
    });
  });

  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive) {
        ws.isAlive = false;
        ws.ping();
      } else {
        ws.terminate();
      }
    });
  }, 30000);

  wss.on("close", () => {
    clearInterval(interval);
  });

  function broadcastMatchCreated(match) {
    broadcastJSON(wss, {
      type: "match_created",
      data: match,
    });
  }
  return {
    broadcastMatchCreated,
  };
}
