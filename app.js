require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const session = require("express-session");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Static oil price data
const oilData = {
  market: "Global Energy Exchange",
  last_updated: "2026-03-15T12:55:00Z",
  currency: "USD",
  data: [
    {
      symbol: "WTI",
      name: "West Texas Intermediate",
      price: 78.45,
      change: 0.12,
    },
    {
      symbol: "BRENT",
      name: "Brent Crude",
      price: 82.3,
      change: -0.05,
    },
    {
      symbol: "NAT_GAS",
      name: "Natural Gas",
      price: 2.15,
      change: 0.02,
    },
  ],
};

// 1) Only allow requests coming from this machine.
app.use((req, res, next) => {
  const allowedIPs = ["127.0.0.1", "::1", "::ffff:127.0.0.1"];
  const clientIP = req.ip || req.socket.remoteAddress;

  if (allowedIPs.includes(clientIP)) {
    return next();
  }

  return res.status(403).send("Forbidden: Access denied");
});

// 2) Only allow requests from the local frontend origin.
// Added POST because JWT login needs a POST request.
const corsOptions = {
  origin: process.env.CORS_ORIGIN || "http://localhost:5500",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(cors(corsOptions));

// 3) Limit traffic to 10 requests per minute.
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests from this IP, please try again later.",
  },
});

app.use(limiter);

// 4) Session is used for dashboard login/logout flow.
app.use(
  session({
    secret: process.env.SESSION_SECRET || "my_super_secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 15 * 60 * 1000,
    },
  })
);

// JWT middleware for the API route
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const jwtSecret = process.env.JWT_SECRET || "my_jwt_secret_key";

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Missing token" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
  }
};

// This protects the dashboard using Basic Auth.
// If the user already has a valid session, let them in directly.
const authenticateBasic = (req, res, next) => {
  if (req.session && req.session.authenticated) {
    return next();
  }

  const authHeader = req.headers.authorization;
  const validUser = process.env.BASIC_USER || "admin";
  const validPass = process.env.BASIC_PASS || "123";

  if (!authHeader || !authHeader.startsWith("Basic ")) {
    res.set("WWW-Authenticate", 'Basic realm="Energy Dashboard"');
    return res.status(401).send("Authentication required");
  }

  const base64Credentials = authHeader.split(" ")[1];
  const credentials = Buffer.from(base64Credentials, "base64").toString("utf-8");
  const [username, password] = credentials.split(":");

  if (username === validUser && password === validPass) {
    req.session.authenticated = true;
    req.session.username = username;
    return next();
  }

  res.set("WWW-Authenticate", 'Basic realm="Energy Dashboard"');
  return res.status(401).send("Invalid username or password");
};

// Simple home page so it's easy to see available routes.
app.get("/", (req, res) => {
  res.send(`
    <h1>Energy API Server</h1>
    <ul>
      <li>POST /api/login (Get JWT)</li>
      <li>GET /api/oil-prices (JWT Bearer Token)</li>
      <li>GET /dashboard (Basic Auth)</li>
      <li>GET /logout</li>
    </ul>
  `);
});

// Login route to generate a JWT
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  const validUser = process.env.API_USER || "admin";
  const validPass = process.env.API_PASS || "123";
  const jwtSecret = process.env.JWT_SECRET || "my_jwt_secret_key";

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  if (username !== validUser || password !== validPass) {
    return res.status(401).json({ error: "Invalid username or password" });
  }

  // Put only simple user info in the token payload
  const token = jwt.sign(
    { username: username, role: "api-user" },
    jwtSecret,
    { expiresIn: "1h" }
  );

  return res.json({
    message: "Login successful",
    token: token,
  });
});

// API endpoint protected by JWT
app.get("/api/oil-prices", authenticateJWT, (req, res) => {
  res.json(oilData);
});

// Dashboard protected by Basic Auth
app.get("/dashboard", authenticateBasic, (req, res) => {
  const rows = oilData.data
    .map(
      (item) => `
      <tr>
        <td>${item.symbol}</td>
        <td>${item.name}</td>
        <td>${oilData.currency} ${item.price}</td>
        <td style="color:${item.change >= 0 ? "green" : "red"};">
          ${item.change}
        </td>
      </tr>
    `
    )
    .join("");

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Energy Dashboard</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f4f6f8; }
        .container { max-width: 900px; margin: auto; background: white; padding: 20px; border-radius: 10px; }
        table { border-collapse: collapse; width: 100%; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
        th { background: #0d6efd; color: white; }
        a.button {
          display: inline-block;
          margin-top: 20px;
          padding: 10px 15px;
          background: #dc3545;
          color: white;
          text-decoration: none;
          border-radius: 6px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Oil Prices Dashboard</h1>
        <p><strong>Market:</strong> ${oilData.market}</p>
        <p><strong>Last Updated:</strong> ${oilData.last_updated}</p>
        <p><strong>Currency:</strong> ${oilData.currency}</p>

        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Name</th>
              <th>Price</th>
              <th>Change</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <a class="button" href="/logout">Logout</a>
      </div>
    </body>
    </html>
  `);
});

// Logout clears the dashboard session
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send("Could not log out");
    }

    res.clearCookie("connect.sid");
    return res.redirect("/logged-out");
  });
});

// Small confirmation page after logout
app.get("/logged-out", (req, res) => {
  res.send(`
    <h1>Logged out</h1>
    <p>You have been successfully logged out.</p>
    <a href="/dashboard">Login again</a>
  `);
});

// Catch any route that does not exist
app.use((req, res) => {
  res.status(404).send("Not Found");
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});