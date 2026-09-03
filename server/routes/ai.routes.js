import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { rateLimit } from "../middlewares/rateLimit.middleware.js";
import {
  confirmBookingIntent,
  confirmAttendanceAction,
  confirmLeaveAction,
  cancelBooking,
  cancelBookingIntent,
  handleAiChat,
} from "../controllers/ai.controller.js";

const router = express.Router();

// Sensitive state-changing endpoints with dedicated rate limiting
const confirmLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  message: "Too many confirmation attempts. Please wait a moment.",
});

const cancelLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  message: "Too many cancellation attempts. Please wait a moment.",
});

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: "Too many chat messages. Please wait a moment.",
});

// Conversational orchestration endpoint
router.post("/chat", protect, chatLimiter, handleAiChat);

// Deterministic Booking Confirmation Boundary (zero LLM write capability)
router.post("/booking/confirm", protect, confirmLimiter, confirmBookingIntent);

// Deterministic Attendance Punch Confirmation Boundary (zero LLM write capability)
router.post("/attendance/confirm", protect, confirmLimiter, confirmAttendanceAction);

// Deterministic Leave Application Confirmation Boundary (zero LLM write capability)
router.post("/leave/confirm", protect, confirmLimiter, confirmLeaveAction);

// Deterministic Cancellation Boundary (zero LLM write capability)
router.post("/booking/cancel", protect, cancelLimiter, cancelBooking);

// Release staged intent
router.delete("/booking/intent/:intentId", protect, cancelBookingIntent);

export default router;
