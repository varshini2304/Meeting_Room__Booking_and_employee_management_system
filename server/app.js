import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import authRoutes from "./routes/auth.routes.js";
import roomRoutes from "./routes/room.routes.js";
import bookingRoutes from "./routes/booking.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import userRoutes from "./routes/user.routes.js";
import attendanceRoutes from "./routes/attendance.routes.js";
import leaveRoutes from "./routes/leave.routes.js";
import aiRoutes from "./routes/ai.routes.js";
import { errorHandler, notFound } from "./middlewares/error.middleware.js";

dotenv.config();

const app = express();
const configuredOrigins = [
  process.env.CLIENT_URL,
  ...(process.env.CLIENT_URLS?.split(",").map((value) => value.trim()) ?? []),
].filter(Boolean);

const defaultOrigins = ["http://localhost:3000", "http://localhost:5173", "http://localhost:8080"];
const allowedOrigins = [...new Set(configuredOrigins.length > 0 ? configuredOrigins : defaultOrigins)];

const isPrivateIpv4 = (hostname) => {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const [a, b] = [Number(match[1]), Number(match[2])];
  return a === 10 || a === 192 && b === 168 || a === 172 && b >= 16 && b <= 31;
};

const isDevLanOrigin = (origin) => {
  if (process.env.NODE_ENV === "production") return false;
  try {
    const url = new URL(origin);
    const hostname = url.hostname.toLowerCase();
    const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1";
    return isLocalHost || isPrivateIpv4(hostname);
  } catch {
    return false;
  }
};

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin) || isDevLanOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

// Request logging middleware for API observability
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    // Only log non-static API requests and health checks
    console.log(`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
});

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.get("/", (req, res) => {
  const startedAt = new Date(Date.now() - process.uptime() * 1000).toISOString();
  res.type("html").send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Meeting Room API</title>
  <style>
    :root { color-scheme: light dark; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 720px; margin: 4rem auto; padding: 0 1.5rem; line-height: 1.6; }
    h1 { margin-bottom: 0.25rem; }
    .ok { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.25rem 0.75rem; border-radius: 999px; background: #e6f7ed; color: #0a6b3a; font-weight: 600; font-size: 0.875rem; }
    .ok::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: #19a05a; }
    code { background: rgba(127,127,127,0.15); padding: 0.1rem 0.4rem; border-radius: 4px; font-size: 0.9em; }
    ul { padding-left: 1.25rem; }
    .meta { color: #666; font-size: 0.9rem; }
    @media (prefers-color-scheme: dark) {
      body { background: #0b0d12; color: #e6e6e6; }
      .ok { background: #0e2a1c; color: #5fdc9b; }
      .meta { color: #aaa; }
    }
  </style>
</head>
<body>
  <span class="ok">Backend is running</span>
  <h1>Meeting Room API</h1>
  <p class="meta">Toyota Meeting Room Booking &amp; Employee Management — backend service.</p>
  <p>This URL serves the JSON API only. The user-facing app lives on the frontend deployment.</p>
  <h3>Useful endpoints</h3>
  <ul>
    <li><code>GET /health</code> — liveness check (returns <code>{"status":"ok"}</code>)</li>
    <li><code>POST /api/auth/login</code> — authenticate</li>
    <li><code>POST /api/auth/register</code> — create account</li>
    <li><code>GET /api/rooms</code> — list rooms (auth required)</li>
    <li><code>GET /api/bookings/my</code> — list your bookings (auth required)</li>
  </ul>
  <p class="meta">Started: ${startedAt} &middot; Uptime: ${Math.round(process.uptime())}s &middot; Node ${process.version}</p>
</body>
</html>`);
});

app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/users", userRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/ai", aiRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
