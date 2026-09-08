import { WebSocket, WebSocketServer } from "ws";
import { wsArcjet } from "../arcjet.js";

const matchSubscribers = new Map();

function subscribeToMatch(matchId, ws) {
  if (!matchSubscribers.has(matchId)) {
    matchSubscribers.set(matchId, new Set());
  }
  matchSubscribers.get(matchId).add(ws);
}

function unsubscribeFromMatch(matchId, ws) {
  const subscribers = matchSubscribers.get(matchId);
  if (!subscribers) return;
  subscribers.delete(ws);
  if (subscribers.size === 0) {
    matchSubscribers.delete(matchId);
  }
}

function cleanupMatchSubscribers(ws) {
  for (const matchId of ws.subscription) {
    unsubscribeFromMatch(matchId, ws);
  }
}

function broadcastToMatchSubscribers(matchId, payload) {
  const subscribers = matchSubscribers.get(matchId);
  if (!subscribers || subscribers.size === 0) return;
  else {
    const message = JSON.stringify(payload);
    for (const client of subscribers) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }
}

function handleMessages(ws, data) {
  let message;

  try {
    message = JSON.parse(data.toString());
  } catch (e) {
    sendJSON(ws, { type: "error", message: "Invalid JSON format" });
  }

  if (message?.type === "subscribe" && Number.isInteger(message.matchId)) {
    subscribeToMatch(message.matchId, ws);
    ws.subscription.add(message.matchId);
    sendJSON(ws, {
      type: "subscribed",
      matchId: message.matchId,
    });
    return;
  }

  if (message?.type === "unsubscribe" && Number.isInteger(message.matchId)) {
    unsubscribeFromMatch(message.matchId, ws);
    ws.subscription.delete(message.matchId);
    sendJSON(ws, {
      type: "unsubscribed",
      matchId: message.matchId,
    });
    return;
  }
}

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

  // server.on("upgrade", async (req, socket, head) => {
  //   const { pathname } = new URL(req.url, `http://${req.headers.host}`);

  //   if (pathname !== "/ws") {
  //     return;
  //   }

  //   if (wsArcjet) {
  //     try {
  //       const decision = await wsArcjet.protect(req);

  //       if (decision.isDenied()) {
  //         if (decision.reason.isRateLimit()) {
  //           socket.write("HTTP/1.1 429 Too Many Requests\r\n\r\n");
  //         } else {
  //           socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
  //         }
  //         socket.destroy();
  //         return;
  //       }
  //     } catch (e) {
  //       console.error("WS upgrade protection error", e);
  //       socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
  //       socket.destroy();
  //       return;
  //     }
  //   }

  //   wss.handleUpgrade(req, socket, head, (ws) => {
  //     wss.emit("connection", ws, req);
  //   });
  // });

  wss.on("connection", async (ws, req) => {
    ws.isAlive = true;

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.subscription = new Set();

    sendJSON(ws, {
      type: "welcome",
      message: "Welcome to the WebSocket server!",
    });

    ws.on("message", (data) => {
      handleMessages(ws, data);
    });

    ws.on("error", (err) => {
      ws.terminate();
    });

    ws.on("close", () => {
      cleanupMatchSubscribers(ws);
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
  function brodcastMatchCommentry(matchId, comment) {
    broadcastToMatchSubscribers(matchId, { type: "commentray", data: comment });
  }
  return {
    broadcastMatchCreated,
    brodcastMatchCommentry,
  };
}
