require("dotenv").config();
const WebSocket = require("ws");
const crypto = require("crypto");
const http = require("http");
const express = require("express");
const jwt = require("jsonwebtoken");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 8080;
// store refresh tokens (in production → DB or Redis)
let refreshTokens = [];

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
  try {
    const { email, password } = req.body;

    const user = users.find(
      u => u.email === email && u.password === password
    );

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!JWT_SECRET) {
      throw new Error("JWT_SECRET is missing in environment variables");
    }

    // ACCESS TOKEN
    const accessToken = jwt.sign(
      { sub: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: "2m" }
    );

    // REFRESH TOKEN (random string)
    const refreshToken = crypto.randomUUID();

    // store refresh token
    refreshTokens.push({
      token: refreshToken,
      userId: user.id
    });

    res.json({
      data: user,
      accessToken,
      refreshToken
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
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

app.post("/refresh", (req, res) => {

  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({ message: "Refresh token missing" });
  }

  const storedToken = refreshTokens.find(t => t.token === refreshToken);
console.log("Body:", req.body);
console.log("Token from client:", refreshToken);
console.log("Stored tokens:", refreshTokens);

  if (!storedToken) {
    return res.status(403).json({ message: "Invalid refresh token" });
  }

  const user = users.find(u => u.id === storedToken.userId);

  if (!user) {
    return res.status(403).json({ message: "User not found" });
  }

  const newAccessToken = jwt.sign(
    { sub: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: "2m" }
  );

  res.json({
    accessToken: newAccessToken
  });

});

app.post("/logout", (req, res) => {
console.log('BODY',req.body)
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({
      message: "Refresh token required"
    });
  }

  // remove refresh token from storage
  refreshTokens = refreshTokens.filter(
    tokenObj => tokenObj.token !== refreshToken
  );

  res.json({
    message: "Logged out successfully"
  });

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