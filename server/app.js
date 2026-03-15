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

app.get("/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/users", userRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/leaves", leaveRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
