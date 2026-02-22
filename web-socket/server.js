require("dotenv").config();
const WebSocket = require("ws");
const crypto = require("crypto");
const http = require("http");
const express = require("express");
const jwt = require("jsonwebtoken");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());

app.use(express.json());

// Health check for Render
app.get("/health", (req, res) => res.send("OK"));

// ---------------- JWT SETUP ----------------

const JWT_SECRET = process.env.JWT_SECRET;

const users = [
  { id: 1, email: "test@test.com", password: "1234", role: "USER" }
];

app.post("/login", (req, res) => {

  const { email, password } = req.body;

  const user = users.find(
    u => u.email === email && u.password === password
  );

  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = jwt.sign(
    { sub: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: "2m" }
  );

  res.json({ data: user, accessToken: token });
});

// JWT middleware
function authenticateToken(req, res, next) {

  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Token missing" });
  }

  jwt.verify(token, JWT_SECRET, (err, payload) => {

    if (err) {
      return res.status(401).json({ message: "Unauthorized Access" });
    }

    req.user = payload;
    next();
  });
}

app.get("/profile", authenticateToken, (req, res) => {
  res.json({
    message: "You are authenticated!",
    user: req.user
  });
});

app.get("/public", (req, res) => {
  res.json({ message: "Anyone can access this" });
});

// ---------------- CREATE HTTP SERVER ----------------

const server = http.createServer(app);

// ---------------- WEBSOCKET ----------------

const wss = new WebSocket.Server({ server });

wss.on("connection", socket => {

  socket.on("message", data => {

    const payload = JSON.parse(data.toString());

    if (payload.type === "message") {
      payload.id = crypto.randomUUID();
      payload.timestamp = Date.now();
    }

    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(payload));
      }
    });

  });

});

// ---------------- START SERVER ----------------

server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});