const WebSocket = require("ws");
const crypto = require("crypto");
const http = require("http");

const PORT = process.env.PORT || 8080;

// Create HTTP server
const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200);
    res.end("OK");
  } else {
    res.writeHead(200);
    res.end("WebSocket server running 🚀");
  }
});

// Attach WebSocket to HTTP server
const wss = new WebSocket.Server({ server });

server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

wss.on("connection", socket => {
  socket.on("message", data => {
    const payload = JSON.parse(data.toString());

    if (payload.type === "message") {
      payload.id = crypto.randomUUID();
      payload.timestamp = Date.now();
    }

    // Broadcast to everyone
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(payload));
      }
    });
  });
});
