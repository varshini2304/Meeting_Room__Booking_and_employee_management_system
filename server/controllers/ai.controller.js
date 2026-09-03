import crypto from "crypto";
import { BookingIntent } from "../models/booking-intent.model.js";
import { AttendanceIntent } from "../models/attendance-intent.model.js";
import { LeaveIntent } from "../models/leave-intent.model.js";
import { Leave } from "../models/leave.model.js";
import { Booking } from "../models/booking.model.js";
import { Room } from "../models/room.model.js";
import { AIConversation } from "../models/ai-conversation.model.js";
import {
  createBooking as createBookingService,
  cancelBooking as cancelBookingService,
  getMyNextBooking,
  getMyUpcomingBookings,
  findMyBookingsByDateTime,
  getMyBookingDetails,
  searchManagerBookings,
  getManagerBookingDetails,
  findManagerBookingsByCriteria,
} from "../services/booking.service.js";
import {
  getRoomAvailabilityService,
  getRoomUtilizationService,
} from "../services/room.service.js";
import {
  checkIn as checkInService,
  checkOut as checkOutService,
  getTodayRecord,
  getTodayDateStr,
  searchManagerAttendance,
  getManagerAttendanceDetails,
  getManagerDailyAttendanceSummary,
  getManagerMonthlyAttendanceSummary,
  getManagerNotCheckedIn,
} from "../services/attendance.service.js";
import {
  getMyBalance,
  getMyLeaves,
  applyLeave,
  validateLeaveEligibility,
  countBusinessDays,
  LEAVE_TYPES,
} from "../services/leave.service.js";
import {
  executeGetMyAttendance,
  executeGetMyAttendanceSummary,
  executeGetMyAttendanceHistory,
  executeGetMyLeaveBalance,
  executeGetMyLeaveRequests,
  executeGetMyLeaveRequestDetails,
  executeGetMyNotifications,
  executeGetMyUnreadNotifications,
  executeGetMyNotificationDetails,
  executeGetMyProfile,
  executeSearchManagerLeaves,
  executeGetManagerLeaveDetails,
  executeGetManagerLeaveBalances,
  executeGetManagerActiveLeavesToday,
  EMPLOYEE_NAVIGATION_DESTINATIONS,
  MANAGER_NAVIGATION_DESTINATIONS,
} from "../services/ai-tools.js";
import { processUserMessage, sanitizeExtractedParams } from "../services/ai.service.js";
import { resolveBranchTimezone } from "../config/timezones.js";
import { resolveDate, resolveTime, validateSlotTiming } from "../utils/dateTimeResolver.js";
import { findAndRankAvailableRooms } from "../services/room-ranking.service.js";
import { createAiContext } from "../services/ai-context.js";
import { buildCapabilityKey } from "../services/ai-capabilities.js";
import { addThirtyMinutes } from "../utils/generateSlots.js";

/**
 * Deterministic REST Confirmation Boundary
 * POST /api/ai/booking/confirm
 *
 * Requirements:
 * - Authenticated via JWT (req.user)
 * - Derive user identity exclusively from req.user._id (never from client/LLM)
 * - 404 INTENT_NOT_FOUND
 * - 403 INTENT_NOT_OWNED
 * - 409 INTENT_ALREADY_RESOLVED
 * - 410 INTENT_EXPIRED
 * - 409 ROOM_NO_LONGER_AVAILABLE
 * - Delegates actual booking creation to existing authoritative createBookingService
 */
export const confirmBookingIntent = async (req, res, next) => {
  try {
    const { intentId } = req.body;
    if (!intentId || typeof intentId !== "string") {
      return res.status(400).json({
        error: "INVALID_REQUEST",
        message: "intentId is required as a string",
      });
    }

    // 1. Locate intent
    const intent = await BookingIntent.findOne({ intentId });
    if (!intent) {
      return res.status(404).json({
        error: "INTENT_NOT_FOUND",
        message: "Booking intent not found",
      });
    }

    // 2. Validate ownership
    if (String(intent.userId) !== String(req.user._id)) {
      return res.status(403).json({
        error: "INTENT_NOT_OWNED",
        message: "You do not have permission to confirm this booking intent",
      });
    }

    // 3. Validate status
    if (intent.status !== "pending") {
      return res.status(409).json({
        error: "INTENT_ALREADY_RESOLVED",
        message: `This booking intent has already been resolved with status: ${intent.status}`,
      });
    }

    // 4. Validate 10-minute business expiry
    if (intent.isExpired()) {
      intent.status = "expired";
      await intent.save();
      return res.status(410).json({
        error: "INTENT_EXPIRED",
        message: "This booking recommendation has expired. Please search again.",
      });
    }

    // 5. Fresh availability check immediately before booking creation
    const existingConflict = await Booking.findOne({
      roomId: intent.roomId,
      date: intent.date,
      startTime: intent.startTime,
      status: "booked",
    }).lean();

    if (existingConflict) {
      return res.status(409).json({
        error: "ROOM_NO_LONGER_AVAILABLE",
        message: "The requested room slot is no longer available. Please select another slot or room.",
      });
    }

    // 6. Delegate authoritative booking creation to existing service
    let booking;
    try {
      booking = await createBookingService({
        ownerId: req.user._id, // User identity strictly from authenticated JWT
        roomId: intent.roomId,
        date: intent.date,
        startTime: intent.startTime,
        invitedMembers: intent.invitedMembers || [],
        title: intent.title || "",
      });
    } catch (createErr) {
      // MongoDB unique index concurrency collision
      if (createErr.code === 11000) {
        return res.status(409).json({
          error: "ROOM_NO_LONGER_AVAILABLE",
          message: "The requested room slot was just booked by another user.",
        });
      }
      return next(createErr);
    }

    // 7. Transition intent to confirmed state
    intent.status = "confirmed";
    intent.bookingId = booking._id;
    intent.confirmedAt = new Date();
    await intent.save();

    return res.status(200).json({
      success: true,
      booking: {
        bookingId: String(booking._id),
        roomNumber: intent.roomNumber,
        roomType: intent.roomType,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Deterministic REST Cancellation Boundary
 * POST /api/ai/booking/cancel
 *
 * Requirements:
 * - Authenticated via JWT (req.user)
 * - Validate ownership and delegate to existing booking.service.js cancelBooking()
 * - 404 BOOKING_NOT_FOUND
 * - 403 FORBIDDEN
 * - 400 ALREADY_CANCELLED
 */
export const cancelBooking = async (req, res, next) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId || typeof bookingId !== "string") {
      return res.status(400).json({
        error: "INVALID_REQUEST",
        message: "bookingId is required as a string",
      });
    }

    const booking = await cancelBookingService(bookingId, req.user._id);

    return res.status(200).json({
      success: true,
      message: "Booking cancelled successfully",
      booking: {
        bookingId: String(booking._id),
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
        canceledAt: booking.canceledAt,
      },
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({
        error: "BOOKING_NOT_FOUND",
        message: error.message || "Booking not found",
      });
    }
    if (error.statusCode === 403) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: error.message || "Only booking owner can cancel",
      });
    }
    if (error.statusCode === 400) {
      return res.status(400).json({
        error: "ALREADY_CANCELLED",
        message: error.message || "Booking is already cancelled",
      });
    }
    return next(error);
  }
};

/**
 * Cancels a pending BookingIntent (e.g., when the user clicks Cancel on the card).
 * DELETE /api/ai/booking/intent/:intentId
 */
export const cancelBookingIntent = async (req, res, next) => {
  try {
    const { intentId } = req.params;
    const intent = await BookingIntent.findOne({ intentId });

    if (!intent) {
      return res.status(404).json({
        error: "INTENT_NOT_FOUND",
        message: "Booking intent not found",
      });
    }

    if (String(intent.userId) !== String(req.user._id)) {
      return res.status(403).json({
        error: "INTENT_NOT_OWNED",
        message: "You do not have permission to modify this booking intent",
      });
    }

    if (intent.status === "pending") {
      intent.status = "cancelled";
      await intent.save();
    }

    return res.status(200).json({
      success: true,
      message: "Booking intent cancelled",
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Deterministic REST Confirmation Boundary for Employee Attendance
 * POST /api/ai/attendance/confirm
 *
 * Requirements:
 * - Authenticated via JWT (req.user)
 * - Derive user identity exclusively from req.user._id (never from client/LLM)
 * - 404 INTENT_NOT_FOUND
 * - 403 INTENT_NOT_OWNED
 * - 409 INTENT_ALREADY_RESOLVED
 * - 410 INTENT_EXPIRED
 * - Revalidates current attendance state (already punched in / out)
 * - Delegates mutation strictly to authoritative checkIn / checkOut service
 */
export const confirmAttendanceAction = async (req, res, next) => {
  try {
    const { intentId } = req.body;
    if (!intentId || typeof intentId !== "string") {
      return res.status(400).json({
        error: "INVALID_REQUEST",
        message: "intentId is required as a string",
      });
    }

    // 1. Locate intent
    const intent = await AttendanceIntent.findOne({ intentId });
    if (!intent) {
      return res.status(404).json({
        error: "INTENT_NOT_FOUND",
        message: "Attendance action intent not found or expired from session.",
      });
    }

    // 2. Authoritative ownership verification
    if (String(intent.userId) !== String(req.user._id)) {
      return res.status(403).json({
        error: "INTENT_NOT_OWNED",
        message: "You are not authorized to confirm this attendance action.",
      });
    }

    // 3. Status check
    if (intent.status !== "pending") {
      return res.status(409).json({
        error: "INTENT_ALREADY_RESOLVED",
        message: `This attendance action has already been ${intent.status}.`,
      });
    }

    // 4. Expiry check (10-minute validity)
    if (intent.isExpired()) {
      intent.status = "expired";
      await intent.save();
      return res.status(410).json({
        error: "INTENT_EXPIRED",
        message: "Attendance action intent has expired. Please stage a new punch request.",
      });
    }

    // 5. Authoritative State Revalidation & Mutation Execution
    let record;
    if (intent.action === "PUNCH_IN") {
      const existing = await getTodayRecord(req.user._id);
      if (existing?.checkInTime) {
        intent.status = "cancelled";
        await intent.save();
        return res.status(409).json({
          error: "ALREADY_CHECKED_IN",
          message: "You have already checked in today.",
        });
      }

      record = await checkInService({
        userId: req.user._id,
        location: intent.location || "",
      });
    } else if (intent.action === "PUNCH_OUT") {
      const existing = await getTodayRecord(req.user._id);
      if (!existing?.checkInTime) {
        intent.status = "cancelled";
        await intent.save();
        return res.status(400).json({
          error: "NOT_CHECKED_IN",
          message: "You have not checked in today.",
        });
      }
      if (existing.checkOutTime) {
        intent.status = "cancelled";
        await intent.save();
        return res.status(409).json({
          error: "ALREADY_CHECKED_OUT",
          message: "You have already checked out today.",
        });
      }

      record = await checkOutService({
        userId: req.user._id,
      });
    } else {
      return res.status(400).json({
        error: "INVALID_ACTION",
        message: `Unrecognized attendance action '${intent.action}'.`,
      });
    }

    // 6. Transition intent to confirmed
    intent.status = "confirmed";
    intent.confirmedAt = new Date();
    intent.attendanceRecordId = record._id;
    await intent.save();

    return res.status(200).json({
      success: true,
      message: intent.action === "PUNCH_IN" ? "Checked in successfully" : "Checked out successfully",
      action: intent.action,
      record: {
        attendanceId: String(record._id),
        date: record.date,
        checkInTime: record.checkInTime,
        checkOutTime: record.checkOutTime,
        status: record.status,
        workHours: record.workHours || 0,
      },
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        error: error.message,
        message: error.message,
      });
    }
    return next(error);
  }
};

/**
 * Deterministic Leave Application Confirmation Boundary
 * POST /api/ai/leave/confirm
 *
 * Requirements:
 * - Authenticated with protect middleware (req.user)
 * - Derives user identity exclusively from req.user._id (never from client/LLM)
 * - 404 INTENT_NOT_FOUND if intent does not exist
 * - 403 INTENT_NOT_OWNED if authenticated user does not match intent.userId
 * - 409 INTENT_ALREADY_RESOLVED if intent is not pending
 * - 410 INTENT_EXPIRED if intent has exceeded 10-minute application lifecycle
 * - Revalidates live leave state (fresh balance, gender constraints, active overlaps) before execution
 * - Delegates actual write mutation to authoritative applyLeave in leave.service.js
 * - Transitions intent to status: 'confirmed'
 */
export const confirmLeaveAction = async (req, res, next) => {
  try {
    const { intentId } = req.body;
    if (!intentId || typeof intentId !== "string") {
      return res.status(400).json({
        error: "INVALID_REQUEST",
        message: "intentId is required to confirm leave application.",
      });
    }

    // 1. Locate staged intent
    const intent = await LeaveIntent.findOne({ intentId });
    if (!intent) {
      return res.status(404).json({
        error: "INTENT_NOT_FOUND",
        message: "Leave application intent not found.",
      });
    }

    // 2. Ownership verification: authenticated user must own the intent
    if (String(intent.userId) !== String(req.user._id)) {
      return res.status(403).json({
        error: "INTENT_NOT_OWNED",
        message: "You are not authorized to confirm this leave application.",
      });
    }

    // 3. Status check: must be pending
    if (intent.status !== "pending") {
      return res.status(409).json({
        error: "INTENT_ALREADY_RESOLVED",
        message: `This leave application has already been ${intent.status}.`,
      });
    }

    // 4. Expiry check: 10-minute application lifecycle
    if (intent.isExpired()) {
      intent.status = "expired";
      await intent.save();
      return res.status(410).json({
        error: "INTENT_EXPIRED",
        message: "Leave application intent has expired. Please stage a new leave request.",
      });
    }

    // 5. Authoritative Full State Revalidation (Fresh balance, gender, overlap checks)
    try {
      await validateLeaveEligibility({
        employeeId: req.user._id,
        leaveType: intent.leaveType,
        startDate: intent.startDate,
        endDate: intent.endDate,
        isHalfDay: intent.isHalfDay,
        halfDayPeriod: intent.halfDayPeriod,
      });
    } catch (valErr) {
      intent.status = "cancelled";
      await intent.save();
      return res.status(valErr.statusCode || 409).json({
        error: "STALE_STATE_CONFLICT",
        message: valErr.message || "Leave eligibility state has changed since staging. Request cancelled.",
      });
    }

    // 6. Execute authoritative mutation via leave service
    const leave = await applyLeave({
      employeeId: req.user._id,
      leaveType: intent.leaveType,
      startDate: intent.startDate,
      endDate: intent.endDate,
      reason: intent.reason,
      isHalfDay: intent.isHalfDay,
      halfDayPeriod: intent.halfDayPeriod,
    });

    // 7. Transition intent to confirmed
    intent.status = "confirmed";
    intent.confirmedAt = new Date();
    intent.leaveId = leave._id;
    await intent.save();

    return res.status(200).json({
      success: true,
      message: `Your ${leave.leaveType} leave application for ${leave.startDate} to ${leave.endDate} has been submitted successfully.`,
      leave: {
        leaveId: String(leave._id),
        leaveType: leave.leaveType,
        startDate: leave.startDate,
        endDate: leave.endDate,
        totalDays: leave.totalDays,
        status: leave.status,
        reason: leave.reason,
        createdAt: leave.createdAt,
      },
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        error: "LEAVE_APPLICATION_ERROR",
        message: error.message,
      });
    }
    return next(error);
  }
};

/**
 * End-to-End Conversational Orchestration
 * POST /api/ai/chat
 *
 * Requirements:
 * - Authenticated with protect middleware (req.user)
 * - AIConversation is authoritative source of truth for rolling 20-message state & rolling 30m TTL
 * - Cross-user session hijacking prevention
 * - Strictly 5 allowed intents
 * - Natural-language confirmation interception: "yes" or "confirm" in chat NEVER creates a booking;
 *   returns a structured pendingIntentCard directing the user to click the Confirm button
 * - V1 single 30-minute booking constraint: clarify and offer first slot for durations >30m
 * - Deterministic date/time/branch resolution
 * - BookingIntent created with status: "pending", expiresAt: 10m, cleanupAt: 24h
 * - Cancellation actions return a structured cancellationCard pointing to POST /api/ai/booking/cancel
 * - Zero write execution from LLM
 */
export const handleAiChat = async (req, res, next) => {
  try {
    const { message, sessionId: incomingSessionId } = req.body;
    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        error: "INVALID_REQUEST",
        message: "message is required as a non-empty string",
      });
    }

    if (message.length > 2000) {
      return res.status(400).json({
        error: "MESSAGE_TOO_LARGE",
        message: "Message exceeds maximum allowed length of 2000 characters",
      });
    }

    const userId = req.user._id;

    // 1. Session resolution & anti-hijacking validation
    let conversation = null;
    if (incomingSessionId && typeof incomingSessionId === "string") {
      const existing = await AIConversation.findOne({ sessionId: incomingSessionId });
      if (existing) {
        // Prevent cross-user hijacking: session must belong to authenticated user
        if (String(existing.userId) === String(userId)) {
          // Verify rolling 30-minute inactivity
          if (new Date() <= existing.expiresAt) {
            conversation = existing;
          }
        }
      }
    }

    // Create new conversation session if none found or expired
    if (!conversation) {
      const newSessionId = "sess_" + crypto.randomUUID();
      conversation = new AIConversation({
        sessionId: newSessionId,
        userId,
        userRole: req.user.role || "employee",
        branch: req.user.branch || "",
      });
    }

    // 2. Natural-language confirmation defense: "yes" / "confirm" in chat CANNOT confirm booking
    const trimmedLower = message.trim().toLowerCase().replace(/[,.!]/g, "").trim();
    const isAffirmation = /^(yes|confirm|confirm booking|book it|go ahead|proceed|yep|sure|please confirm|yes please confirm)$/i.test(trimmedLower) ||
      /^yes\b.*confirm/i.test(trimmedLower);

    if (isAffirmation && conversation.pendingIntentId) {
      if (conversation.pendingIntentId.startsWith("att_intent_")) {
        const pendingAttendanceIntent = await AttendanceIntent.findOne({ intentId: conversation.pendingIntentId });
        if (pendingAttendanceIntent && pendingAttendanceIntent.status === "pending" && !pendingAttendanceIntent.isExpired()) {
          conversation.addMessage({ role: "user", content: message });
          const actionLabel = pendingAttendanceIntent.action === "PUNCH_IN" ? "punch in" : "punch out";
          const btnLabel = pendingAttendanceIntent.action === "PUNCH_IN" ? "Confirm Punch In" : "Confirm Punch Out";
          const reply = `To confirm your attendance ${actionLabel}, please click the '${btnLabel}' button on the action card. For security, attendance punch actions cannot be confirmed through chat messages alone.`;
          conversation.addMessage({ role: "assistant", content: reply });
          await conversation.save();

          return res.status(200).json({
            sessionId: conversation.sessionId,
            domain: "ATTENDANCE",
            action: pendingAttendanceIntent.action,
            intent: "GENERAL_HELP",
            reply,
            pendingIntentCard: null,
            cancellationCard: null,
            attendanceActionCard: {
              intentId: pendingAttendanceIntent.intentId,
              action: pendingAttendanceIntent.action,
              title: pendingAttendanceIntent.action === "PUNCH_IN" ? "Punch In for Today" : "Punch Out for Today",
              date: pendingAttendanceIntent.date,
              time: pendingAttendanceIntent.stagedAtTime,
              status: "pending",
              actionText: btnLabel,
              confirmEndpoint: "/api/ai/attendance/confirm",
            },
            leaveRequestCard: null,
            turnCount: conversation.turnCount,
          });
        }
      } else if (conversation.pendingIntentId.startsWith("leave_intent_")) {
        const pendingLeaveIntent = await LeaveIntent.findOne({ intentId: conversation.pendingIntentId });
        if (pendingLeaveIntent && pendingLeaveIntent.status === "pending" && !pendingLeaveIntent.isExpired()) {
          conversation.addMessage({ role: "user", content: message });
          const typeCap = pendingLeaveIntent.leaveType.toUpperCase();
          const reply = `To confirm your application for ${typeCap} leave (${pendingLeaveIntent.startDate} to ${pendingLeaveIntent.endDate}), please click the 'Confirm Leave Application' button on the request card. For security, leave applications cannot be confirmed through chat messages alone.`;
          conversation.addMessage({ role: "assistant", content: reply });
          await conversation.save();

          return res.status(200).json({
            sessionId: conversation.sessionId,
            domain: "LEAVE",
            action: "APPLY",
            intent: "GENERAL_HELP",
            reply,
            pendingIntentCard: null,
            cancellationCard: null,
            attendanceActionCard: null,
            leaveRequestCard: {
              intentId: pendingLeaveIntent.intentId,
              leaveType: pendingLeaveIntent.leaveType,
              title: `${pendingLeaveIntent.leaveType.charAt(0).toUpperCase() + pendingLeaveIntent.leaveType.slice(1)} Leave Application`,
              startDate: pendingLeaveIntent.startDate,
              endDate: pendingLeaveIntent.endDate,
              totalDays: pendingLeaveIntent.totalDays,
              reason: pendingLeaveIntent.reason,
              isHalfDay: pendingLeaveIntent.isHalfDay,
              actionText: "Confirm Leave Application",
              confirmEndpoint: "/api/ai/leave/confirm",
            },
            turnCount: conversation.turnCount,
          });
        }
      } else {
        const pendingBookingIntent = await BookingIntent.findOne({ intentId: conversation.pendingIntentId });
        if (pendingBookingIntent && pendingBookingIntent.status === "pending" && !pendingBookingIntent.isExpired()) {
          conversation.addMessage({ role: "user", content: message });
          const reply = `To confirm your reservation for Room ${pendingBookingIntent.roomNumber}, please click the 'Confirm Booking' button on the reservation card. For security, reservations cannot be confirmed through chat messages alone.`;
          conversation.addMessage({ role: "assistant", content: reply });
          await conversation.save();

          return res.status(200).json({
            sessionId: conversation.sessionId,
            intent: "BOOK_ROOM",
            reply,
            pendingIntentCard: {
              intentId: pendingBookingIntent.intentId,
              roomNumber: pendingBookingIntent.roomNumber,
              roomType: pendingBookingIntent.roomType,
              branch: pendingBookingIntent.branch,
              date: pendingBookingIntent.date,
              startTime: pendingBookingIntent.startTime,
              endTime: pendingBookingIntent.endTime,
              attendeeCount: pendingBookingIntent.attendeeCount,
              expiresAt: pendingBookingIntent.expiresAt,
              action: "CONFIRM_REQUIRED",
              confirmEndpoint: "/api/ai/booking/confirm",
            },
            cancellationCard: null,
            attendanceActionCard: null,
            leaveRequestCard: null,
            turnCount: conversation.turnCount,
          });
        }
      }
    }

    // 3. Add incoming user message to persistent conversation history
    conversation.addMessage({ role: "user", content: message });

    // 4. Check for multi-slot duration request (> 30 mins)
    const durationMatch = message.match(/\b(1|2|3|4)\s*(hour|hr|hours|hrs)\b|\b(60|90|120)\s*(min|mins|minute|minutes)\b/i);
    let durationClarification = "";
    if (durationMatch) {
      durationClarification = "Toyota meeting rooms currently support single 30-minute bookings in V1. I can reserve the first 30-minute slot for you.";
    }

    // 5. LLM intent extraction and query orchestration
    const aiResult = await processUserMessage({
      message,
      history: conversation.messages.slice(0, -1),
      context: { user: req.user },
    });

    let reply = aiResult.reply || "";
    let pendingIntentCard = null;
    let cancellationCard = null;

    // Merge extracted parameters with session history
    const extractedParams = sanitizeExtractedParams({
      ...(conversation.extractedParams || {}),
      ...(aiResult.extractedParams || {}),
    });

    // 6. Domain, Action, and Capability Resolution
    const domain = aiResult.domain || "GENERAL";
    const action = aiResult.action || "HELP";
    const intent = aiResult.intent || "GENERAL_HELP";
    const capabilityKey = buildCapabilityKey(domain, action);

    // 7. Branch and authoritative timezone resolution
    const requestedBranch = (domain === "BOOKING" ? extractedParams.branch : null) || req.user.branch || "";
    const timeZone = resolveBranchTimezone(requestedBranch) || resolveBranchTimezone(req.user.branch) || "Asia/Kolkata";

    if (domain === "BOOKING" && extractedParams.branch && resolveBranchTimezone(extractedParams.branch) === null) {
      reply = "Toyota branches currently supported are Bangalore, Hyderabad, and Chennai. Which branch would you like to book in?";
      conversation.addMessage({ role: "assistant", content: reply });
      await conversation.save();
      return res.status(200).json({
        sessionId: conversation.sessionId,
        domain: "GENERAL",
        action: "HELP",
        intent: "GENERAL_HELP",
        reply,
        pendingIntentCard: null,
        cancellationCard: null,
        attendanceActionCard: null,
        leaveRequestCard: null,
        navigation: null,
        turnCount: conversation.turnCount,
      });
    }

    // 8. Server-Authoritative Context Object & Capability Authorization
    const aiContext = createAiContext(req.user, { requestedBranch });

    // Enforce server-side role authorization
    if (!aiContext.isAuthorized(capabilityKey)) {
      const unauthorizedReply = `I am sorry, but your current account role (${aiContext.role}) is not authorized to access ${domain}:${action}.`;
      conversation.addMessage({ role: "assistant", content: unauthorizedReply });
      await conversation.save();
      return res.status(403).json({
        error: "FORBIDDEN_CAPABILITY",
        message: unauthorizedReply,
        capabilityKey,
        role: aiContext.role,
      });
    }

    // 8. Dispatch to Domain Action Handler
    const handler = CAPABILITY_HANDLERS[capabilityKey] || handleGeneralHelpIntent;
    const actionResult = await handler({
      req,
      conversation,
      extractedParams,
      timeZone,
      requestedBranch,
      durationClarification,
      aiResult,
      aiContext,
    });

    reply = actionResult.reply;
    pendingIntentCard = actionResult.pendingIntentCard || null;
    cancellationCard = actionResult.cancellationCard || null;
    const attendanceActionCard = actionResult.attendanceActionCard || null;
    const leaveRequestCard = actionResult.leaveRequestCard || null;
    const navigation = actionResult.navigation || null;

    // 9. Append Assistant Message & Persist Conversation State
    conversation.addMessage({ role: "assistant", content: reply });
    conversation.currentIntent = intent;
    conversation.extractedParams = extractedParams;
    await conversation.save();

    return res.status(200).json({
      sessionId: conversation.sessionId,
      domain,
      action,
      intent,
      reply,
      pendingIntentCard,
      cancellationCard,
      attendanceActionCard,
      leaveRequestCard,
      navigation,
      turnCount: conversation.turnCount,
    });
  } catch (error) {
    return next(error);
  }
};

// ── DOMAIN ACTION HANDLERS (Phase 7 Modular Architecture) ────────────────────

/**
 * BOOKING:BOOK Handler
 */
const handleBookingBookIntent = async ({
  req,
  conversation,
  extractedParams,
  timeZone,
  requestedBranch,
  durationClarification,
}) => {
  if (!extractedParams.date) {
    return {
      reply:
        (durationClarification ? durationClarification + " " : "") +
        "What date would you like to book the room for? (e.g., 'today', 'tomorrow', or 'YYYY-MM-DD')",
    };
  }
  if (!extractedParams.startTime) {
    return {
      reply:
        (durationClarification ? durationClarification + " " : "") +
        "What start time would you prefer? (Meeting rooms operate from 08:00 AM to 08:00 PM in 30-minute slots)",
    };
  }
  if (!extractedParams.attendeeCount) {
    return { reply: "How many attendees will be attending the meeting?" };
  }

  const dateRes = resolveDate(extractedParams.date, timeZone);
  if (dateRes.error) return { reply: dateRes.error };

  const timeRes = resolveTime(extractedParams.startTime);
  if (timeRes.needsClarification) return { reply: timeRes.clarificationMessage };
  if (timeRes.error) return { reply: timeRes.error };

  const timingCheck = validateSlotTiming(dateRes.resolvedDate, timeRes.resolvedStartTime, timeZone);
  if (!timingCheck.isValid) return { reply: timingCheck.error };

  const rankResult = await findAndRankAvailableRooms({
    date: dateRes.resolvedDate,
    startTime: timeRes.resolvedStartTime,
    attendeeCount: extractedParams.capacity || extractedParams.attendeeCount,
    capacity: extractedParams.capacity || extractedParams.attendeeCount,
    roomType: extractedParams.roomType || "",
    requestedAmenities: extractedParams.requestedAmenities || [],
    userBranch: requestedBranch,
    requestedBranch,
    userCountry: req.user.country || "India",
  });

  if (rankResult.candidates.length === 0) {
    return {
      reply: `No meeting rooms matching your criteria are available for ${dateRes.resolvedDate} at ${timeRes.resolvedStartTime}. Would you like to try another time or adjust amenities?`,
    };
  }

  const bestRoom = rankResult.candidates[0];
  const resolvedEndTime = addThirtyMinutes(timeRes.resolvedStartTime);

  const intentId = "intent_" + crypto.randomUUID();
  const bookingIntent = new BookingIntent({
    intentId,
    sessionId: conversation.sessionId,
    userId: req.user._id,
    roomId: bestRoom.roomId,
    roomNumber: bestRoom.roomNumber,
    roomType: bestRoom.roomType,
    branch: bestRoom.branch,
    block: bestRoom.block,
    floor: bestRoom.floor,
    date: dateRes.resolvedDate,
    startTime: timeRes.resolvedStartTime,
    endTime: resolvedEndTime,
    attendeeCount: extractedParams.attendeeCount,
    requestedAmenities: extractedParams.requestedAmenities || [],
    invitedMembers: [],
    title: extractedParams.title || "Meeting",
    status: "pending",
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    cleanupAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
  await bookingIntent.save();

  conversation.pendingIntentId = intentId;

  return {
    reply:
      (durationClarification ? durationClarification + "\n\n" : "") +
      `I found the best match for you: **Room ${bestRoom.roomNumber}** (${bestRoom.roomType}, Capacity: ${bestRoom.capacity}) in **${bestRoom.branch}**.\n\nPlease review and click **Confirm Booking** on the reservation card below within 10 minutes.`,
    pendingIntentCard: {
      intentId,
      roomNumber: bestRoom.roomNumber,
      roomType: bestRoom.roomType,
      branch: bestRoom.branch,
      block: bestRoom.block,
      floor: bestRoom.floor,
      date: dateRes.resolvedDate,
      startTime: timeRes.resolvedStartTime,
      endTime: resolvedEndTime,
      attendeeCount: extractedParams.attendeeCount,
      requestedAmenities: extractedParams.requestedAmenities || [],
      expiresAt: bookingIntent.expiresAt,
      action: "CONFIRM_REQUIRED",
      confirmEndpoint: "/api/ai/booking/confirm",
    },
  };
};

/**
 * BOOKING:SEARCH Handler
 * Supports advanced search with capacity, independent roomType, and recommendation reasons.
 */
const handleBookingSearchIntent = async ({ extractedParams, timeZone, requestedBranch, req }) => {
  if (extractedParams.date && extractedParams.startTime) {
    const dateRes = resolveDate(extractedParams.date, timeZone);
    const timeRes = resolveTime(extractedParams.startTime);
    if (dateRes.resolvedDate && timeRes.resolvedStartTime) {
      const rankResult = await findAndRankAvailableRooms({
        date: dateRes.resolvedDate,
        startTime: timeRes.resolvedStartTime,
        attendeeCount: extractedParams.capacity || extractedParams.attendeeCount || 1,
        capacity: extractedParams.capacity || extractedParams.attendeeCount || 1,
        roomType: extractedParams.roomType || "",
        requestedAmenities: extractedParams.requestedAmenities || [],
        userBranch: requestedBranch,
        requestedBranch,
        userCountry: req.user.country || "India",
      });

      if (rankResult.candidates.length > 0) {
        const list = rankResult.candidates
          .slice(0, 5)
          .map((c) => {
            const reasonStr = c.recommendationReason ? `\n   *${c.recommendationReason}*` : "";
            return `- **Room ${c.roomNumber}** (${c.roomType}, Capacity: ${c.capacity}${c.floor ? `, ${c.floor}` : ""}${c.amenities?.length ? `, Amenities: ${c.amenities.join(", ")}` : ""})${reasonStr}`;
          })
          .join("\n");
        return {
          reply: `Here are available rooms in **${requestedBranch || "our offices"}** for **${dateRes.resolvedDate}** at **${timeRes.resolvedStartTime}**:\n\n${list}\n\nWould you like me to reserve one of these rooms for you?`,
        };
      }
      return {
        reply: `No rooms matching your criteria are available in **${requestedBranch || "the selected branch"}** for ${dateRes.resolvedDate} at ${timeRes.resolvedStartTime}.`,
      };
    }
  }

  // Browse branch active rooms with optional capacity & roomType filtering
  const branchQuery = requestedBranch ? { branch: requestedBranch, isActive: true } : { isActive: true };
  let activeRooms = await Room.find(branchQuery).sort({ roomNumber: 1 }).lean();

  if (extractedParams.roomType) {
    const targetType = extractedParams.roomType.trim().toLowerCase();
    activeRooms = activeRooms.filter((r) => {
      const rt = (r.roomType || "").toLowerCase();
      if (targetType.includes("conference")) return rt.includes("conference");
      if (targetType.includes("meeting")) return rt.includes("meeting");
      return rt.includes(targetType);
    });
  }

  if (extractedParams.capacity) {
    const reqCap = Number(extractedParams.capacity);
    activeRooms = activeRooms.filter((r) => r.capacity >= reqCap);
  }

  if (activeRooms.length > 0) {
    const list = activeRooms
      .map(
        (r) =>
          `- **Room ${r.roomNumber}** (${r.roomType}, Capacity: ${r.capacity} people${r.floor ? `, ${r.floor}` : ""}${r.amenities?.length ? ` | Amenities: ${r.amenities.join(", ")}` : ""})`
      )
      .join("\n");
    return {
      reply: `Here are the meeting rooms in **${requestedBranch || "our offices"}**${extractedParams.roomType ? ` matching **${extractedParams.roomType}**` : ""}${extractedParams.capacity ? ` with capacity ≥ ${extractedParams.capacity}` : ""}:\n\n${list}\n\nTo check specific slot availability or reserve a room, tell me your preferred date and time (e.g., *"tomorrow at 3 PM for 5 people"*).`,
    };
  }
  return {
    reply: `No active meeting rooms were found for **${requestedBranch || "the requested criteria"}**.`,
  };
};

/**
 * BOOKING:MY_BOOKINGS Handler
 */
const handleBookingMyBookingsIntent = async ({ req, timeZone, aiResult, extractedParams }) => {
  if (aiResult?.reply && aiResult.reply.includes("You can only view your own meetings")) {
    return { reply: aiResult.reply };
  }
  if (extractedParams?.targetEmployee && extractedParams.targetEmployee.toLowerCase() !== req.user.name?.toLowerCase()) {
    return {
      reply: `You can only view your own meetings and reservations. Access to ${extractedParams.targetEmployee}'s booking data is not permitted.`,
    };
  }

  const bookings = await getMyUpcomingBookings({
    userId: req.user._id,
    timeZone,
  });

  if (bookings.length > 0) {
    const list = bookings
      .map(
        (b, i) =>
          `${i + 1}. **Room ${b.roomId?.roomNumber || "Unknown"}** (${b.roomId?.branch || ""}) on ${b.date} from ${b.startTime} to ${b.endTime} ("${b.title || "Meeting"}")`
      )
      .join("\n");
    return { reply: `Here are your upcoming reservations:\n\n${list}` };
  }
  return { reply: "You currently have no active upcoming room reservations." };
};

/**
 * BOOKING:GET_NEXT Handler
 * Retrieves the earliest strictly-future meeting for the authenticated employee.
 */
const handleBookingGetNextIntent = async ({ req, timeZone }) => {
  const booking = await getMyNextBooking({
    userId: req.user._id,
    timeZone,
  });

  if (!booking) {
    return { reply: "You currently have no upcoming meetings scheduled." };
  }

  const checkInText = booking.occupancyConfirmedAt
    ? `Checked in at ${new Date(booking.occupancyConfirmedAt).toLocaleTimeString("en-IN", { timeZone, hour: "2-digit", minute: "2-digit", hour12: true })}`
    : "Not checked in (check-in opens at meeting start time)";

  return {
    reply: `Here is your **Next Meeting**:\n\n- **Room**: Room ${booking.roomId?.roomNumber || "Unknown"} (${booking.roomId?.roomType || "Meeting Room"})\n- **Location**: ${booking.roomId?.branch || ""}${booking.roomId?.floor ? `, ${booking.roomId.floor}` : ""}\n- **Date**: ${booking.date}\n- **Time**: ${booking.startTime}–${booking.endTime}\n- **Title**: "${booking.title || "Meeting"}"\n- **Status**: **${booking.status}**\n- **Check-in**: ${checkInText}`,
  };
};

/**
 * BOOKING:GET_UPCOMING Handler
 * Retrieves upcoming meetings for today, tomorrow, or a specific date.
 */
const handleBookingGetUpcomingIntent = async ({ extractedParams, req, timeZone }) => {
  let targetDate = undefined;
  let dateLabel = "upcoming";

  if (extractedParams.date) {
    const dateRes = resolveDate(extractedParams.date, timeZone);
    if (dateRes.resolvedDate) {
      targetDate = dateRes.resolvedDate;
      dateLabel = extractedParams.date;
    }
  }

  const bookings = await getMyUpcomingBookings({
    userId: req.user._id,
    date: targetDate,
    timeZone,
  });

  if (bookings.length > 0) {
    const list = bookings
      .map(
        (b, i) =>
          `${i + 1}. **Room ${b.roomId?.roomNumber || "Unknown"}** (${b.roomId?.branch || ""}) on ${b.date} from ${b.startTime} to ${b.endTime} ("${b.title || "Meeting"}")`
      )
      .join("\n");
    return { reply: `Here are your meetings for **${dateLabel}**:\n\n${list}` };
  }

  return { reply: `You have no scheduled meetings for **${dateLabel}**.` };
};

/**
 * BOOKING:GET_DETAILS Handler
 * Retrieves full details for a booking with ambiguity handling (0 matches, 1 match, 2+ matches).
 */
const handleBookingGetDetailsIntent = async ({ extractedParams, req, timeZone }) => {
  // If specific booking ID was provided
  if (extractedParams.bookingId) {
    try {
      const b = await getMyBookingDetails({
        bookingId: extractedParams.bookingId,
        userId: req.user._id,
      });
      const checkInStatus = b.occupancyConfirmedAt
        ? `Checked in at ${new Date(b.occupancyConfirmedAt).toLocaleTimeString("en-IN", { timeZone, hour: "2-digit", minute: "2-digit", hour12: true })}`
        : "Not checked in (check-in opens at start time)";

      return {
        reply: `**Meeting Details for Room ${b.roomId?.roomNumber || "Unknown"}**:\n\n- **Title**: "${b.title || "Meeting"}"\n- **Room Type**: ${b.roomId?.roomType || "Meeting Room"} (Capacity: ${b.roomId?.capacity || "N/A"})\n- **Location**: ${b.roomId?.branch || ""}${b.roomId?.block ? `, ${b.roomId.block}` : ""}${b.roomId?.floor ? `, ${b.roomId.floor}` : ""}\n- **Date**: ${b.date}\n- **Time**: ${b.startTime}–${b.endTime}\n- **Amenities**: ${b.roomId?.amenities?.join(", ") || "Standard"}\n- **Reservation Status**: **${b.status}**\n- **Occupancy Status**: ${checkInStatus}`,
      };
    } catch (err) {
      return { reply: err.message || "Booking not found or access denied." };
    }
  }

  // Resolve target date / time if provided
  let targetDate = undefined;
  if (extractedParams.date) {
    const dateRes = resolveDate(extractedParams.date, timeZone);
    if (dateRes.resolvedDate) targetDate = dateRes.resolvedDate;
  }

  let targetStartTime = undefined;
  if (extractedParams.startTime) {
    const timeRes = resolveTime(extractedParams.startTime);
    if (timeRes.resolvedStartTime) targetStartTime = timeRes.resolvedStartTime;
  }

  const matches = await findMyBookingsByDateTime({
    userId: req.user._id,
    date: targetDate,
    startTime: targetStartTime,
  });

  // Ambiguity Resolution: 0 matches
  if (matches.length === 0) {
    const criteriaStr = [targetDate, targetStartTime].filter(Boolean).join(" at ");
    return {
      reply: `I could not find any active reservations for you${criteriaStr ? ` on ${criteriaStr}` : ""}.`,
    };
  }

  // Ambiguity Resolution: 2+ matches -> ask clarification
  if (matches.length > 1) {
    const list = matches
      .map(
        (m, idx) =>
          `${idx + 1}. **Room ${m.roomId?.roomNumber || "Unknown"}** on ${m.date} from ${m.startTime} to ${m.endTime} ("${m.title || "Meeting"}")`
      )
      .join("\n");
    return {
      reply: `I found multiple reservations matching your query:\n\n${list}\n\nWhich meeting would you like details for? Please specify the room number or title.`,
    };
  }

  // Ambiguity Resolution: exactly 1 match -> return full details
  const b = matches[0];
  const checkInStatus = b.occupancyConfirmedAt
    ? `Checked in at ${new Date(b.occupancyConfirmedAt).toLocaleTimeString("en-IN", { timeZone, hour: "2-digit", minute: "2-digit", hour12: true })}`
    : "Not checked in (check-in opens at start time)";

  return {
    reply: `**Meeting Details for Room ${b.roomId?.roomNumber || "Unknown"}**:\n\n- **Title**: "${b.title || "Meeting"}"\n- **Room Type**: ${b.roomId?.roomType || "Meeting Room"} (Capacity: ${b.roomId?.capacity || "N/A"})\n- **Location**: ${b.roomId?.branch || ""}${b.roomId?.block ? `, ${b.roomId.block}` : ""}${b.roomId?.floor ? `, ${b.roomId.floor}` : ""}\n- **Date**: ${b.date}\n- **Time**: ${b.startTime}–${b.endTime}\n- **Amenities**: ${b.roomId?.amenities?.join(", ") || "Standard"}\n- **Reservation Status**: **${b.status}**\n- **Occupancy Status**: ${checkInStatus}`,
  };
};

/**
 * BOOKING:GET_STATUS Handler
 * Separates reservation lifecycle status (booked/cancelled/completed) from check-in occupancy status.
 */
const handleBookingGetStatusIntent = async ({ extractedParams, req, timeZone }) => {
  let targetDate = undefined;
  if (extractedParams.date) {
    const dateRes = resolveDate(extractedParams.date, timeZone);
    if (dateRes.resolvedDate) targetDate = dateRes.resolvedDate;
  }

  let targetStartTime = undefined;
  if (extractedParams.startTime) {
    const timeRes = resolveTime(extractedParams.startTime);
    if (timeRes.resolvedStartTime) targetStartTime = timeRes.resolvedStartTime;
  }

  let match = null;
  if (extractedParams.bookingId) {
    try {
      match = await getMyBookingDetails({ bookingId: extractedParams.bookingId, userId: req.user._id });
    } catch {
      match = null;
    }
  } else if (targetDate || targetStartTime) {
    const matches = await findMyBookingsByDateTime({
      userId: req.user._id,
      date: targetDate,
      startTime: targetStartTime,
    });
    if (matches.length > 1) {
      const list = matches
        .map(
          (m, idx) =>
            `${idx + 1}. **Room ${m.roomId?.roomNumber || "Unknown"}** on ${m.date} at ${m.startTime} ("${m.title || "Meeting"}")`
        )
        .join("\n");
      return {
        reply: `I found multiple reservations matching your query:\n\n${list}\n\nWhich booking status would you like to check?`,
      };
    }
    match = matches[0] || null;
  } else {
    // If no specific date/time provided, check the next active upcoming meeting
    match = await getMyNextBooking({ userId: req.user._id, timeZone });
  }

  if (!match) {
    return { reply: "I could not find any active booking to check the status for." };
  }

  const occupancyText = match.occupancyConfirmedAt
    ? `Occupied (Checked in at ${new Date(match.occupancyConfirmedAt).toLocaleTimeString("en-IN", { timeZone, hour: "2-digit", minute: "2-digit", hour12: true })})`
    : "Pending check-in (Window opens at meeting start time)";

  return {
    reply: `**Status for Room ${match.roomId?.roomNumber || "Unknown"} (${match.date} at ${match.startTime})**:\n\n- **Reservation Lifecycle Status**: **${match.status}**\n- **Occupancy / Check-in Status**: ${occupancyText}\n- **Meeting Title**: "${match.title || "Meeting"}"`,
  };
};

/**
 * BOOKING:CANCEL Handler
 */
const handleBookingCancelIntent = async ({ req }) => {
  const activeBookings = await getMyUpcomingBookings({
    userId: req.user._id,
  });

  if (activeBookings.length === 0) {
    return { reply: "You currently have no active upcoming room reservations to cancel." };
  }

  const target = activeBookings[0];
  return {
    reply: `I found your reservation for **Room ${target.roomId?.roomNumber}** on **${target.date}** at **${target.startTime}–${target.endTime}**.\n\nTo cancel this reservation, please click **Confirm Cancellation** on the card below.`,
    cancellationCard: {
      bookingId: String(target._id),
      roomNumber: target.roomId?.roomNumber || "Unknown",
      branch: target.roomId?.branch || "",
      date: target.date,
      startTime: target.startTime,
      endTime: target.endTime,
      action: "CANCEL_REQUIRED",
      cancelEndpoint: "/api/ai/booking/cancel",
    },
  };
};

/**
 * ATTENDANCE:GET_TODAY Handler
 */
const handleAttendanceGetToday = async ({ req, extractedParams, aiResult }) => {
  if (aiResult?.reply && aiResult.reply.includes("You can only view your own attendance records")) {
    return { reply: aiResult.reply };
  }
  if (extractedParams?.targetEmployee && extractedParams.targetEmployee.toLowerCase() !== req.user.name?.toLowerCase()) {
    return {
      reply: `You can only view your own attendance records. Access to ${extractedParams.targetEmployee}'s attendance is not permitted.`,
    };
  }

  const res = await executeGetMyAttendance({ date: "today" }, { user: req.user });
  if (res.error) return { reply: res.message || "Failed to retrieve today's attendance." };

  const statusText = `**Status**: ${res.status.toUpperCase()}`;
  const punchInText = res.checkInTime ? `**Punch In**: ${res.checkInTime}` : "**Punch In**: Not yet recorded";
  const punchOutText = res.checkOutTime ? `**Punch Out**: ${res.checkOutTime}` : "**Punch Out**: Not yet recorded";
  const hoursText = res.workHours ? `\n- **Work Hours**: ${res.workHours} hours` : "";

  let prompt = "";
  if (!res.isPunchedIn) {
    prompt = "\n\nWould you like me to punch you in for today?";
  } else if (!res.isPunchedOut) {
    prompt = "\n\nWould you like me to punch you out for today?";
  } else {
    prompt = "\n\nYou have completed your attendance for today.";
  }

  const reply = `Here is your attendance record for today (**${res.date}**):\n\n- ${statusText}\n- ${punchInText}\n- ${punchOutText}${hoursText}${prompt}`;
  return { reply };
};

/**
 * ATTENDANCE:GET_BY_DATE Handler
 */
const handleAttendanceGetByDate = async ({ req, extractedParams }) => {
  if (extractedParams?.targetEmployee && extractedParams.targetEmployee.toLowerCase() !== req.user.name?.toLowerCase()) {
    return {
      reply: `You can only view your own attendance records. Access to ${extractedParams.targetEmployee}'s attendance is not permitted.`,
    };
  }

  const res = await executeGetMyAttendance({ date: extractedParams?.date || "yesterday" }, { user: req.user });
  if (res.error) return { reply: res.message || "Failed to retrieve attendance record." };

  const statusText = `**Status**: ${res.status.toUpperCase()}`;
  const punchInText = res.checkInTime ? `**Punch In**: ${res.checkInTime}` : "**Punch In**: Not recorded";
  const punchOutText = res.checkOutTime ? `**Punch Out**: ${res.checkOutTime}` : "**Punch Out**: Not recorded";
  const hoursText = res.workHours ? `\n- **Work Hours**: ${res.workHours} hours` : "";

  const reply = `Here is your attendance record for **${res.date}**:\n\n- ${statusText}\n- ${punchInText}\n- ${punchOutText}${hoursText}`;
  return { reply };
};

/**
 * ATTENDANCE:GET_SUMMARY Handler
 */
const handleAttendanceGetSummary = async ({ req, extractedParams }) => {
  if (extractedParams?.targetEmployee && extractedParams.targetEmployee.toLowerCase() !== req.user.name?.toLowerCase()) {
    return {
      reply: `You can only view your own attendance records. Access to ${extractedParams.targetEmployee}'s attendance is not permitted.`,
    };
  }

  const res = await executeGetMyAttendanceSummary(
    { month: extractedParams?.month, year: extractedParams?.year },
    { user: req.user }
  );
  if (res.error) return { reply: res.message || "Failed to calculate attendance summary." };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const monthName = monthNames[res.month - 1] || `Month ${res.month}`;

  const reply = `Here is your attendance summary for **${monthName} ${res.year}**:\n\n- **Present Days**: ${res.present}\n- **Absent Days**: ${res.absent}\n- **Late Arrivals**: ${res.late}\n- **Half Days**: ${res.halfDay}\n- **On Leave**: ${res.onLeave}\n- **Total Work Hours**: ${res.totalWorkHours} hours\n- **Average Daily Hours**: ${res.avgWorkHours} hours/day`;
  return { reply };
};

/**
 * ATTENDANCE:GET_HISTORY Handler
 */
const handleAttendanceGetHistory = async ({ req, extractedParams }) => {
  if (extractedParams?.targetEmployee && extractedParams.targetEmployee.toLowerCase() !== req.user.name?.toLowerCase()) {
    return {
      reply: `You can only view your own attendance records. Access to ${extractedParams.targetEmployee}'s attendance is not permitted.`,
    };
  }

  const res = await executeGetMyAttendanceHistory(extractedParams || {}, { user: req.user });
  if (res.error) return { reply: res.message || "Failed to retrieve attendance history." };

  if (res.records.length === 0) {
    return { reply: "You currently have no attendance records for this period." };
  }

  const list = res.records
    .slice(0, 7)
    .map(
      (r) =>
        `- **${r.date}**: ${r.status.toUpperCase()} (In: ${r.checkInTime || "—"}, Out: ${r.checkOutTime || "—"}, Work: ${r.workHours} hrs)`
    )
    .join("\n");

  const reply = `Here are your recent attendance records:\n\n${list}`;
  return { reply };
};

/**
 * ATTENDANCE:PUNCH_IN Handler
 */
const handleAttendancePunchIn = async ({ req, conversation, timeZone }) => {
  const existing = await getTodayRecord(req.user._id);
  const now = new Date();
  const formatPunchTime = (d) =>
    new Date(d).toLocaleTimeString("en-IN", {
      timeZone: timeZone || "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

  if (existing?.checkInTime) {
    return {
      reply: `You have already punched in today (**${existing.date}**) at **${formatPunchTime(existing.checkInTime)}**. Your current status is **${existing.status.toUpperCase()}**.`,
    };
  }

  const todayStr = getTodayDateStr();
  const currentTimeStr = now.toLocaleTimeString("en-IN", {
    timeZone: timeZone || "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const intentId = "att_intent_" + crypto.randomUUID();
  const attendanceIntent = new AttendanceIntent({
    intentId,
    sessionId: conversation.sessionId,
    userId: req.user._id,
    action: "PUNCH_IN",
    date: todayStr,
    stagedAtTime: currentTimeStr,
    status: "pending",
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    cleanupAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
  await attendanceIntent.save();

  conversation.pendingIntentId = intentId;

  const attendanceActionCard = {
    intentId,
    action: "PUNCH_IN",
    title: "Punch In for Today",
    date: todayStr,
    time: currentTimeStr,
    status: existing?.status || "absent",
    actionText: "Confirm Punch In",
    confirmEndpoint: "/api/ai/attendance/confirm",
  };

  return {
    reply: `You are about to punch in for today's attendance (**${todayStr}** at **${currentTimeStr}**).\n\nPlease click **Confirm Punch In** on the action card below within 10 minutes to record your arrival.`,
    attendanceActionCard,
  };
};

/**
 * ATTENDANCE:PUNCH_OUT Handler
 */
const handleAttendancePunchOut = async ({ req, conversation, timeZone }) => {
  const existing = await getTodayRecord(req.user._id);
  const now = new Date();
  const formatPunchTime = (d) =>
    new Date(d).toLocaleTimeString("en-IN", {
      timeZone: timeZone || "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

  if (!existing?.checkInTime) {
    return {
      reply: "You have not punched in yet today. You must punch in first before you can punch out.",
    };
  }

  if (existing.checkOutTime) {
    return {
      reply: `You have already punched out today at **${formatPunchTime(existing.checkOutTime)}**. Total work hours: **${existing.workHours} hours**.`,
    };
  }

  const todayStr = getTodayDateStr();
  const currentTimeStr = now.toLocaleTimeString("en-IN", {
    timeZone: timeZone || "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const intentId = "att_intent_" + crypto.randomUUID();
  const attendanceIntent = new AttendanceIntent({
    intentId,
    sessionId: conversation.sessionId,
    userId: req.user._id,
    action: "PUNCH_OUT",
    date: todayStr,
    stagedAtTime: currentTimeStr,
    status: "pending",
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    cleanupAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
  await attendanceIntent.save();

  conversation.pendingIntentId = intentId;

  const attendanceActionCard = {
    intentId,
    action: "PUNCH_OUT",
    title: "Punch Out for Today",
    date: todayStr,
    time: currentTimeStr,
    status: existing.status,
    checkInTime: formatPunchTime(existing.checkInTime),
    actionText: "Confirm Punch Out",
    confirmEndpoint: "/api/ai/attendance/confirm",
  };

  return {
    reply: `You are about to punch out for today (**${todayStr}** at **${currentTimeStr}**).\n\nPlease click **Confirm Punch Out** on the card below within 10 minutes to record your departure.`,
    attendanceActionCard,
  };
};

/**
 * LEAVE:GET_BALANCE Handler
 */
const handleLeaveGetBalance = async ({ req, aiResult }) => {
  if (aiResult?.reply && aiResult.reply.includes("You can only view your own leave records")) {
    return { reply: aiResult.reply };
  }

  const res = await executeGetMyLeaveBalance({}, { user: req.user });
  if (res.error) return { reply: res.message || "Failed to retrieve leave balances." };

  const lines = res.balances
    .filter((b) => b.total > 0)
    .map((b) => {
      const typeCapitalized = b.type.charAt(0).toUpperCase() + b.type.slice(1);
      if (b.total >= 999) {
        return `- **${typeCapitalized}**: Unlimited (Used: ${b.used} days)`;
      }
      return `- **${typeCapitalized}**: **${b.remaining} days remaining** (${b.used} used, ${b.pending} pending of ${b.total} total)`;
    })
    .join("\n");

  const reply = `Here is your **${res.year}** leave balance summary:\n\n${lines}\n\nTo apply for leave, say for example *"Apply casual leave tomorrow"* or *"Apply sick leave from Sept 10 to Sept 12"*.`;
  return { reply };
};

/**
 * LEAVE:GET_MY_REQUESTS Handler
 */
const handleLeaveGetMyRequests = async ({ req, extractedParams, aiResult }) => {
  if (aiResult?.reply && aiResult.reply.includes("You can only view your own leave records")) {
    return { reply: aiResult.reply };
  }

  const res = await executeGetMyLeaveRequests(extractedParams, { user: req.user });
  if (res.error) return { reply: res.message || "Failed to retrieve leave requests." };

  if (!res.requests || res.requests.length === 0) {
    return { reply: "You currently have no leave requests on file." };
  }

  const list = res.requests
    .map((l) => {
      const typeCap = l.leaveType.charAt(0).toUpperCase() + l.leaveType.slice(1);
      const statusCap = l.status.toUpperCase();
      let item = `- **${typeCap} Leave** (${l.startDate} → ${l.endDate}, ${l.totalDays} day${l.totalDays !== 1 ? "s" : ""}): **${statusCap}**`;
      if (l.reason) item += `\n  - Reason: ${l.reason}`;
      if (l.reviewNotes && l.status === "rejected") item += `\n  - Rejection Note: ${l.reviewNotes}`;
      return item;
    })
    .join("\n");

  const reply = `Here are your recent leave requests:\n\n${list}`;
  return { reply };
};

/**
 * LEAVE:GET_REQUEST_DETAILS Handler
 */
const handleLeaveGetRequestDetails = async ({ req, extractedParams, aiResult }) => {
  if (aiResult?.reply && aiResult.reply.includes("You can only view your own leave records")) {
    return { reply: aiResult.reply };
  }

  const res = await executeGetMyLeaveRequestDetails(extractedParams, { user: req.user });
  if (!res.success || !res.leave) {
    return { reply: "I could not find a matching leave request in your records." };
  }

  const l = res.leave;
  const typeCap = l.leaveType.charAt(0).toUpperCase() + l.leaveType.slice(1);
  let reply = `**${typeCap} Leave Request Details**:\n\n` +
    `- **Period**: ${l.startDate} to ${l.endDate} (${l.totalDays} business day${l.totalDays !== 1 ? "s" : ""})\n` +
    `- **Status**: **${l.status.toUpperCase()}**\n` +
    `- **Reason**: ${l.reason}`;

  if (l.status === "rejected") {
    reply += `\n- **Rejection Reason**: ${l.reviewNotes || "No specific rejection remarks provided by your manager."}`;
  } else if (l.status === "approved") {
    reply += `\n- **Approval**: Approved by your manager${l.reviewNotes ? ` (${l.reviewNotes})` : ""}.`;
  } else if (l.status === "pending") {
    reply += `\n- **Note**: This request is currently pending manager approval.`;
  }

  return { reply };
};

/**
 * LEAVE:CHECK_ELIGIBILITY Handler (Informational Inquiry - Never stages LeaveIntent)
 */
const handleLeaveCheckEligibility = async ({ req, extractedParams, aiResult }) => {
  if (aiResult?.reply && aiResult.reply.includes("You can only view your own leave records")) {
    return { reply: aiResult.reply };
  }

  const leaveType = extractedParams.leaveType || "casual";
  const startDate = extractedParams.startDate;
  const endDate = extractedParams.endDate || startDate;

  if (!startDate) {
    return {
      reply: "Which date or date range would you like to check leave eligibility for?",
    };
  }

  try {
    const val = await validateLeaveEligibility({
      employeeId: req.user._id,
      leaveType,
      startDate,
      endDate,
      isHalfDay: Boolean(extractedParams.isHalfDay),
      halfDayPeriod: extractedParams.halfDayPeriod || "",
    });

    const typeCap = leaveType.charAt(0).toUpperCase() + leaveType.slice(1);
    const reply = `✓ **Leave Eligible**: You are eligible to take **${val.totalDays} business day(s)** of **${typeCap} Leave** from **${startDate}** to **${endDate}**.\n\n` +
      `- Remaining balance: **${val.rem} days**\n` +
      `- No overlapping leaves found.\n\n` +
      `To submit this application, say *"Apply ${leaveType} leave from ${startDate} to ${endDate} for [your reason]"*.`;

    return { reply };
  } catch (err) {
    return {
      reply: `Cannot take leave for the requested dates: **${err.message}**.`,
    };
  }
};

/**
 * LEAVE:APPLY Handler (Stages LeaveIntent requiring explicit UI confirmation)
 */
const handleLeaveApply = async ({ req, conversation, extractedParams }) => {
  const leaveType = extractedParams.leaveType;
  if (!leaveType) {
    return {
      reply: "What type of leave would you like to apply for? (Supported: Casual, Sick, Earned, Menstrual, Relocation, Unpaid, Maternity, Paternity)",
    };
  }

  const startDate = extractedParams.startDate;
  if (!startDate) {
    return {
      reply: `What date or date range would you like to take **${leaveType}** leave? (e.g., 'tomorrow', or '2026-09-10 to 2026-09-12')`,
    };
  }

  const endDate = extractedParams.endDate || startDate;

  const reason = extractedParams.reason;
  if (!reason) {
    return {
      reply: `What is the reason for your **${leaveType}** leave request from **${startDate}** to **${endDate}**?`,
    };
  }

  // Authoritative server-side pre-validation
  let validation;
  try {
    validation = await validateLeaveEligibility({
      employeeId: req.user._id,
      leaveType,
      startDate,
      endDate,
      isHalfDay: Boolean(extractedParams.isHalfDay),
      halfDayPeriod: extractedParams.halfDayPeriod || "",
    });
  } catch (err) {
    return {
      reply: `Unable to stage leave application: **${err.message}**. Please adjust your request.`,
    };
  }

  const intentId = "leave_intent_" + crypto.randomUUID();
  const leaveIntent = new LeaveIntent({
    intentId,
    sessionId: conversation.sessionId,
    userId: req.user._id,
    leaveType,
    startDate,
    endDate,
    totalDays: validation.totalDays, // Deterministically calculated on server; never trusted from LLM
    reason,
    isHalfDay: Boolean(extractedParams.isHalfDay),
    halfDayPeriod: extractedParams.halfDayPeriod || "",
    status: "pending",
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes business validity
    cleanupAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours TTL
  });
  await leaveIntent.save();

  conversation.pendingIntentId = intentId;

  const typeCap = leaveType.charAt(0).toUpperCase() + leaveType.slice(1);
  const leaveRequestCard = {
    intentId,
    leaveType,
    title: `${typeCap} Leave Application`,
    startDate,
    endDate,
    totalDays: validation.totalDays,
    reason,
    isHalfDay: Boolean(extractedParams.isHalfDay),
    actionText: "Confirm Leave Application",
    confirmEndpoint: "/api/ai/leave/confirm",
  };

  return {
    reply: `I have prepared your leave request for **${typeCap} Leave** (${startDate} to ${endDate}, ${validation.totalDays} business day${validation.totalDays !== 1 ? "s" : ""}).\n\nPlease review the details on the card below and click **Confirm Leave Application** within 10 minutes to submit your request.`,
    leaveRequestCard,
  };
};

/**
 * NOTIFICATION:GET_MY_NOTIFICATIONS Handler
 */
const handleNotificationGetMy = async ({ extractedParams, aiContext, aiResult }) => {
  if (aiResult?.reply && aiResult.reply.includes("You can only view your own notifications")) {
    return { reply: aiResult.reply };
  }
  if (extractedParams?.targetEmployee) {
    return {
      reply: `You can only view your own notifications. Access to ${extractedParams.targetEmployee}'s notification data is not permitted.`,
    };
  }

  const res = await executeGetMyNotifications(extractedParams, aiContext);
  if (!res.success || !res.notifications.length) {
    return { reply: "You have no notifications in your inbox right now." };
  }
  const lines = res.notifications.map((n) => {
    const statusIcon = n.isRead ? "✓" : "🔔 **[NEW]**";
    const dateStr = new Date(n.createdAt).toLocaleString("en-IN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    return `• ${statusIcon} **${n.title}** (${dateStr})\n  ${n.message}`;
  });
  return {
    reply: `Here are your recent notifications (${res.count}):\n\n${lines.join("\n\n")}`,
  };
};

/**
 * NOTIFICATION:GET_UNREAD Handler
 */
const handleNotificationGetUnread = async ({ extractedParams, aiContext }) => {
  const res = await executeGetMyUnreadNotifications(extractedParams, aiContext);
  if (!res.success || res.unreadCount === 0) {
    return {
      reply: "You have **0 unread notifications**. You're all caught up! 🎉",
    };
  }
  const lines = res.notifications.map((n) => {
    const dateStr = new Date(n.createdAt).toLocaleString("en-IN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    return `• 🔔 **${n.title}** (${dateStr})\n  ${n.message}`;
  });
  return {
    reply: `You have **${res.unreadCount} unread notification${res.unreadCount > 1 ? "s" : ""}**:\n\n${lines.join("\n\n")}`,
  };
};

/**
 * NOTIFICATION:GET_NOTIFICATION_DETAILS Handler
 */
const handleNotificationGetDetails = async ({ extractedParams, aiContext }) => {
  const res = await executeGetMyNotificationDetails(extractedParams, aiContext);
  if (res?.ambiguous && res?.candidates?.length) {
    const list = res.candidates
      .map((c, i) => `${i + 1}. **${c.title}** (ID: \`${c.id}\`, ${new Date(c.createdAt).toLocaleDateString("en-IN")})`)
      .join("\n");
    return {
      reply: `Multiple notifications matched your query:\n\n${list}\n\nPlease specify the notification ID to view full details.`,
    };
  }
  if (!res?.success || !res?.notification) {
    return { reply: "I could not find the details for that notification." };
  }
  const n = res.notification;
  const dateStr = new Date(n.createdAt).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return {
    reply: `### Notification Details\n- **Title**: ${n.title}\n- **Message**: ${n.message}\n- **Category**: ${n.type}\n- **Date**: ${dateStr}\n- **Status**: ${n.isRead ? "Read" : "Unread"}`,
  };
};

/**
 * PROFILE:GET_MY_PROFILE Handler
 */
const handleProfileGetMy = async ({ extractedParams, aiContext, aiResult }) => {
  if (aiResult?.reply && aiResult.reply.includes("You can only view your own profile")) {
    return { reply: aiResult.reply };
  }
  if (extractedParams?.targetEmployee) {
    return {
      reply: `You can only view your own profile. Access to ${extractedParams.targetEmployee}'s profile data is not permitted.`,
    };
  }

  const res = await executeGetMyProfile(extractedParams, aiContext);
  if (!res?.success || !res?.profile) {
    return { reply: "Unable to retrieve your employee profile at this time." };
  }
  const p = res.profile;
  const heading = p.role === "manager" ? "### Manager Profile" : "### Employee Profile";
  return {
    reply: `${heading}\n- **Name**: ${p.name}\n- **Employee ID**: ${p.employeeId}\n- **Role**: ${p.role.toUpperCase()}\n- **Branch**: ${p.branch || "Toyota Enterprise"}\n- **Country**: ${p.country || "India"}\n- **Department**: ${p.department || "General Operations"}\n- **Designation**: ${p.designation || "Employee"}\n- **Email**: ${p.email}\n- **Phone**: ${p.phone || "Not specified"}${p.joiningDate ? `\n- **Joined**: ${p.joiningDate}` : ""}`,
  };
};

/**
 * NAVIGATION:OPEN_EMPLOYEE_PAGE Handler
 */
const handleNavigationOpen = async ({ extractedParams, aiResult }) => {
  if (aiResult?.reply && (
    aiResult.reply.includes("Access to manager administration") ||
    aiResult.reply.includes("Navigation is only permitted") ||
    aiResult.reply.includes("Which records would you like to open")
  )) {
    return { reply: aiResult.reply, navigation: null };
  }

  const destKey = extractedParams?.destination;
  if (!destKey || !EMPLOYEE_NAVIGATION_DESTINATIONS[destKey]) {
    return {
      reply: "I could not find that page destination. Available pages are: dashboard, book room, my bookings, booking history, attendance, leaves, notifications, and profile.",
      navigation: null,
    };
  }

  const dest = EMPLOYEE_NAVIGATION_DESTINATIONS[destKey];
  return {
    reply: `I have prepared navigation to **${dest.label}**. Click below to open the page.`,
    navigation: {
      destination: destKey,
      path: dest.path,
      label: dest.label,
      actionText: `Open ${dest.label}`,
    },
  };
};

// ── PHASE 12: MANAGER BOOKING & ROOM INTELLIGENCE HANDLERS ───────────────────

/**
 * BOOKING:GET_ALL Handler
 * Retrieves enterprise bookings across all employees, defaulting to today's date if unspecified.
 */
const handleBookingGetAllIntent = async ({ extractedParams, timeZone }) => {
  const todayParts = resolveDate("today", timeZone);
  const targetDate = extractedParams?.date ? resolveDate(extractedParams.date, timeZone).resolvedDate : todayParts.resolvedDate;
  const isDefaultToday = !extractedParams?.date;

  const result = await searchManagerBookings({
    date: targetDate,
    limit: 15,
  });

  if (result.count === 0) {
    const defaultNote = isDefaultToday ? ` (showing today, ${targetDate}, by default)` : ` for ${targetDate}`;
    return {
      reply: `No enterprise bookings found${defaultNote}. You can specify another date or apply filters by branch, room, or employee name.`,
    };
  }

  const prefix = isDefaultToday
    ? `Showing **${result.count}** enterprise booking(s) for today (**${targetDate}**) by default. You can specify another date or filter by branch/room/employee.\n\n`
    : `Found **${result.count}** enterprise booking(s) for **${targetDate}**:\n\n`;

  const lines = result.bookings.map((b, i) => {
    const roomLabel = b.roomId?.roomNumber ? `${b.roomId.roomNumber} (${b.roomId.branch})` : "Room";
    const ownerLabel = b.ownerId?.name ? `${b.ownerId.name}` : "Unknown";
    const statusLabel = b.status === "cancelled" ? "❌ Cancelled" : b.occupancyConfirmedAt ? "✅ Occupied" : "📅 Booked";
    const titleLabel = b.title ? ` ("${b.title}")` : "";
    return `${i + 1}. **${b.date} ${b.startTime}-${b.endTime}** — ${roomLabel}${titleLabel}\n   • Organizer: ${ownerLabel}\n   • Status: ${statusLabel}\n   • ID: \`${b._id}\``;
  });

  const suffix = '\n\n💡 *Tip: To view complete details for a booking, ask "Tell me about booking [ID]".*';
  return { reply: prefix + lines.join("\n\n") + suffix };
};

/**
 * BOOKING:SEARCH_MANAGER Handler
 * Filters enterprise bookings by employee name, branch, roomNumber, status, and date range.
 * Handles 0/1/many employee name matches deterministically.
 */
const handleBookingSearchManagerIntent = async ({ extractedParams, timeZone }) => {
  let resolvedDate = undefined;
  if (extractedParams?.date) {
    const dRes = resolveDate(extractedParams.date, timeZone);
    if (dRes.resolvedDate) resolvedDate = dRes.resolvedDate;
  }

  let resolvedStartDate = undefined;
  if (extractedParams?.startDate) {
    const sRes = resolveDate(extractedParams.startDate, timeZone);
    if (sRes.resolvedDate) resolvedStartDate = sRes.resolvedDate;
  }

  let resolvedEndDate = undefined;
  if (extractedParams?.endDate) {
    const eRes = resolveDate(extractedParams.endDate, timeZone);
    if (eRes.resolvedDate) resolvedEndDate = eRes.resolvedDate;
  }

  const result = await searchManagerBookings({
    date: resolvedDate,
    startDate: resolvedStartDate,
    endDate: resolvedEndDate,
    branch: extractedParams?.branch,
    roomNumber: extractedParams?.roomNumber,
    employeeName: extractedParams?.employeeName,
    status: extractedParams?.status,
    startTime: extractedParams?.startTime,
    limit: 20,
  });

  if (result.employeeMatchStatus === "NOT_FOUND") {
    return {
      reply: `No employee matching "${extractedParams.employeeName}" was found in the enterprise directory. Please check the spelling or search by room or branch.`,
    };
  }

  if (result.employeeMatchStatus === "AMBIGUOUS") {
    const list = result.matchedEmployees.map((e) => `• **${e.name}** (${e.email}, ID: ${e.employeeId || "-"})`).join("\n");
    return {
      reply: `Multiple employees matched "${extractedParams.employeeName}":\n\n${list}\n\nPlease specify the full name or employee ID to filter bookings.`,
    };
  }

  if (result.count === 0) {
    const filterDesc = [
      extractedParams?.employeeName ? `employee "${extractedParams.employeeName}"` : null,
      extractedParams?.branch ? `branch "${extractedParams.branch}"` : null,
      extractedParams?.roomNumber ? `room "${extractedParams.roomNumber}"` : null,
      resolvedDate ? `date ${resolvedDate}` : null,
      extractedParams?.status ? `status "${extractedParams.status}"` : null,
    ].filter(Boolean).join(", ");

    return {
      reply: `No enterprise bookings found matching criteria (${filterDesc || "current filters"}).`,
    };
  }

  const lines = result.bookings.map((b, i) => {
    const roomLabel = b.roomId?.roomNumber ? `${b.roomId.roomNumber} (${b.roomId.branch})` : "Room";
    const ownerLabel = b.ownerId?.name ? `${b.ownerId.name}` : "Employee";
    const statusLabel = b.status === "cancelled" ? "❌ Cancelled" : b.occupancyConfirmedAt ? "✅ Occupied" : "📅 Booked";
    const titleLabel = b.title ? ` ("${b.title}")` : "";
    return `${i + 1}. **${b.date} ${b.startTime}-${b.endTime}** — ${roomLabel}${titleLabel}\n   • Organizer: ${ownerLabel}\n   • Status: ${statusLabel}\n   • ID: \`${b._id}\``;
  });

  const summaryHeader = `Found **${result.count}** matching booking(s):\n\n`;
  const tip = '\n\n💡 *Tip: To view complete details for a booking, ask "Tell me about booking [ID]".*';
  return { reply: summaryHeader + lines.join("\n\n") + tip };
};

/**
 * BOOKING:GET_DETAILS_MGR Handler
 * Retrieves full details for any enterprise booking.
 * Direct by bookingId, or 0/1/2+ candidate resolution for indirect criteria.
 */
const handleBookingGetDetailsManagerIntent = async ({ extractedParams, timeZone }) => {
  // Direct bookingId lookup
  if (extractedParams?.bookingId) {
    const booking = await getManagerBookingDetails({ bookingId: extractedParams.bookingId });
    if (!booking) {
      return {
        reply: `Booking with ID \`${extractedParams.bookingId}\` was not found. Please verify the ID.`,
      };
    }

    const room = booking.roomId;
    const owner = booking.ownerId;
    const occupancyStatus = booking.occupancyConfirmedAt
      ? `Confirmed Occupied (Checked in at ${new Date(booking.occupancyConfirmedAt).toLocaleTimeString("en-IN", { timeZone })})`
      : "Not Checked In";

    const details = [
      `### Booking Details (\`${booking._id}\`)`,
      `• **Title:** ${booking.title || "Meeting"}`,
      `• **Date & Time:** ${booking.date}, ${booking.startTime} - ${booking.endTime}`,
      `• **Status:** ${booking.status.toUpperCase()}`,
      `• **Physical Occupancy:** ${occupancyStatus}`,
      `• **Room:** ${room?.roomNumber || "Unknown"} (${room?.roomType || "Meeting Room"}, Capacity: ${room?.capacity || "-"})`,
      `• **Location:** ${room?.branch || "-"}, Block ${room?.block || "-"}, Floor ${room?.floor || "-"}`,
      `• **Organizer:** ${owner?.name || "Unknown"} (${owner?.email || "-"}, ID: ${owner?.employeeId || "-"})`,
      booking.invitedMembers?.length
        ? `• **Invited Participants (${booking.invitedMembers.length}):** ${booking.invitedMembers.map((m) => m.name || m.email).join(", ")}`
        : null,
    ].filter(Boolean).join("\n");

    return { reply: details };
  }

  // Indirect criteria candidate lookup (0 / 1 / 2+ ambiguity handling)
  const candidates = await findManagerBookingsByCriteria({
    date: extractedParams?.date ? resolveDate(extractedParams.date, timeZone).resolvedDate : undefined,
    startTime: extractedParams?.startTime,
    roomNumber: extractedParams?.roomNumber,
    employeeName: extractedParams?.employeeName,
    branch: extractedParams?.branch,
  });

  if (candidates.length === 0) {
    return {
      reply: "No bookings found matching those criteria. Please provide a specific booking ID or date/time.",
    };
  }

  if (candidates.length === 1) {
    const booking = candidates[0];
    const room = booking.roomId;
    const owner = booking.ownerId;
    const occupancyStatus = booking.occupancyConfirmedAt
      ? `Confirmed Occupied (Checked in at ${new Date(booking.occupancyConfirmedAt).toLocaleTimeString("en-IN", { timeZone })})`
      : "Not Checked In";

    const details = [
      `### Booking Details (\`${booking._id}\`)`,
      `• **Title:** ${booking.title || "Meeting"}`,
      `• **Date & Time:** ${booking.date}, ${booking.startTime} - ${booking.endTime}`,
      `• **Status:** ${booking.status.toUpperCase()}`,
      `• **Physical Occupancy:** ${occupancyStatus}`,
      `• **Room:** ${room?.roomNumber || "Unknown"} (${room?.roomType || "Meeting Room"}, Capacity: ${room?.capacity || "-"})`,
      `• **Location:** ${room?.branch || "-"}, Block ${room?.block || "-"}, Floor ${room?.floor || "-"}`,
      `• **Organizer:** ${owner?.name || "Unknown"} (${owner?.email || "-"}, ID: ${owner?.employeeId || "-"})`,
    ].join("\n");

    return { reply: details };
  }

  // 2+ matches: Ambiguity resolution
  const candidateList = candidates.map((b, i) => {
    const roomStr = b.roomId?.roomNumber ? `${b.roomId.roomNumber} (${b.roomId.branch})` : "Room";
    const ownerStr = b.ownerId?.name || "Unknown";
    return `${i + 1}. **${b.date} ${b.startTime}-${b.endTime}** in ${roomStr} (Organizer: ${ownerStr}) — ID: \`${b._id}\``;
  }).join("\n");

  return {
    reply: `Multiple bookings matched your inquiry:\n\n${candidateList}\n\nPlease specify which booking ID you would like details for.`,
  };
};

/**
 * ROOM:GET_AVAILABILITY_MGR Handler
 * Inspects room availability and occupancy status for managers.
 */
const handleRoomGetAvailabilityManagerIntent = async ({ extractedParams, timeZone }) => {
  if (!extractedParams?.date) {
    return {
      reply: "What date would you like to check room availability for? (e.g., 'today', 'tomorrow', or 'YYYY-MM-DD')",
    };
  }
  if (!extractedParams?.startTime) {
    return {
      reply: "What time would you like to check room availability for? (e.g., '14:00' or '2:00 PM')",
    };
  }

  const dateRes = resolveDate(extractedParams.date, timeZone);
  if (!dateRes.resolvedDate) return { reply: dateRes.error || "Please provide a valid date." };

  const timeRes = resolveTime(extractedParams.startTime);
  if (!timeRes.resolvedStartTime) return { reply: timeRes.error || "Please provide a valid start time." };

  const result = await getRoomAvailabilityService({
    date: dateRes.resolvedDate,
    startTime: timeRes.resolvedStartTime,
    filters: {
      branch: extractedParams?.branch,
      roomType: extractedParams?.roomType,
    },
  });

  const availableRooms = result.rooms.filter((r) => r.isAvailable);
  const occupiedRooms = result.rooms.filter((r) => !r.isAvailable);

  const header = `### Room Availability for ${dateRes.resolvedDate} at ${timeRes.resolvedStartTime}${extractedParams?.branch ? ` (${extractedParams.branch})` : ""}\n\n`;

  let body = "";
  if (availableRooms.length > 0) {
    body += `**Available Rooms (${availableRooms.length}):**\n`;
    body += availableRooms.map((r) => `• **${r.roomNumber}** (${r.roomType}, Cap: ${r.capacity}) — Floor ${r.floor}, ${r.branch}`).join("\n");
  } else {
    body += "❌ **All rooms are currently booked for this time slot.**";
  }

  if (occupiedRooms.length > 0) {
    body += `\n\n**Booked/Occupied Rooms (${occupiedRooms.length}):**\n`;
    body += occupiedRooms.map((r) => `• **${r.roomNumber}** (${r.roomType}) — ${r.branch}`).join("\n");
  }

  return { reply: header + body };
};

/**
 * ROOM:GET_UTILIZATION_MGR Handler
 * Inspects room booking and physical check-in counts. No ungrounded percentages.
 */
const handleRoomGetUtilizationManagerIntent = async ({ extractedParams, timeZone }) => {
  let startDate = extractedParams?.startDate;
  let endDate = extractedParams?.endDate;

  if (!startDate || !endDate) {
    const pad = (n) => String(n).padStart(2, "0");
    const now = new Date();
    const day = now.getDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    const monday = new Date(now.getTime() + diffToMon * 24 * 60 * 60 * 1000);
    const sunday = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000);
    startDate = `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;
    endDate = `${sunday.getFullYear()}-${pad(sunday.getMonth() + 1)}-${pad(sunday.getDate())}`;
  } else {
    const sRes = resolveDate(startDate, timeZone);
    const eRes = resolveDate(endDate, timeZone);
    if (sRes.resolvedDate) startDate = sRes.resolvedDate;
    if (eRes.resolvedDate) endDate = eRes.resolvedDate;
  }

  const result = await getRoomUtilizationService({
    roomNumber: extractedParams?.roomNumber,
    branch: extractedParams?.branch,
    startDate,
    endDate,
  });

  if (result.rooms.length === 0) {
    return {
      reply: `No rooms found matching ${extractedParams?.roomNumber ? `room ${extractedParams.roomNumber}` : "criteria"} for evaluation period ${startDate} to ${endDate}.`,
    };
  }

  const header = `### Room Booking & Occupancy Report (${startDate} to ${endDate})\n\n` +
    `*Note: Reservation count reflects scheduled bookings; check-ins reflect verified physical room occupancy.*\n\n`;

  const roomLines = result.rooms.map((r) => {
    return `• **Room ${r.roomNumber}** (${r.branch}, ${r.roomType}):\n` +
      `   - Total Reservations: **${r.totalBookings}** (Active: ${r.activeBookings}, Completed: ${r.completedBookings}, Cancelled: ${r.cancelledBookings})\n` +
      `   - Confirmed Physical Check-ins: **${r.confirmedCheckIns}**`;
  }).join("\n\n");

  return { reply: header + roomLines };
};

/**
 * NAVIGATION:OPEN_MGR_PAGE Handler
 * Generates navigation payload to allowlisted manager destination.
 */
const handleNavigationOpenManagerPage = async ({ extractedParams }) => {
  const destKey = extractedParams?.destination;
  if (!destKey || !MANAGER_NAVIGATION_DESTINATIONS[destKey]) {
    const validKeys = Object.keys(MANAGER_NAVIGATION_DESTINATIONS).join(", ");
    return {
      reply: `I could not find that manager page. Available manager destinations are: ${validKeys}.`,
      navigation: null,
    };
  }

  const dest = MANAGER_NAVIGATION_DESTINATIONS[destKey];
  return {
    reply: `Opening **${dest.label}**. Click below to navigate to the page.`,
    navigation: {
      destination: destKey,
      path: dest.path,
      label: dest.label,
      actionText: `Open ${dest.label}`,
    },
  };
};

// ── PHASE 13: MANAGER ATTENDANCE INTELLIGENCE HANDLERS ───────────────────────

/**
 * ATTENDANCE:GET_ALL_MANAGER Handler
 * Retrieves team/enterprise attendance for a target date (defaults to today with explicit notification).
 */
const handleAttendanceGetAllManagerIntent = async ({ extractedParams, timeZone }) => {
  const isDefaultToday = !extractedParams?.date || extractedParams.date === "today";
  const targetDate = extractedParams?.date
    ? resolveDate(extractedParams.date, timeZone).resolvedDate
    : resolveDate("today", timeZone).resolvedDate;

  const result = await searchManagerAttendance({
    date: targetDate,
    limit: 20,
  });

  if (result.count === 0) {
    const defaultNote = isDefaultToday ? ` (showing today, ${targetDate}, by default)` : ` for ${targetDate}`;
    return {
      reply: `No attendance records found${defaultNote}. You can specify another date or search by employee name.`,
    };
  }

  const prefix = isDefaultToday
    ? `Showing **${result.count}** attendance record(s) for today (**${targetDate}**) by default:\n\n`
    : `Found **${result.count}** attendance record(s) for **${targetDate}**:\n\n`;

  const lines = result.records.map((r, i) => {
    const empName = r.employee?.name || "Employee";
    const dept = r.employee?.department ? ` (${r.employee.department})` : "";
    const inTime = r.checkInTime ? new Date(r.checkInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
    const outTime = r.checkOutTime ? new Date(r.checkOutTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
    const statusEmoji = r.status === "present" ? "✅" : r.status === "late" ? "⚠️" : r.status === "half-day" ? "🌗" : r.status === "on-leave" ? "🏖️" : "❌";
    return `${i + 1}. **${empName}**${dept} — ${statusEmoji} ${r.status.toUpperCase()}\n   • In: ${inTime} | Out: ${outTime} | Work Hours: ${r.workHours || 0}h`;
  });

  return { reply: prefix + lines.join("\n\n") };
};

/**
 * ATTENDANCE:SEARCH_MANAGER Handler
 * Multi-parameter search across employee attendance records.
 */
const handleAttendanceSearchManagerIntent = async ({ extractedParams, timeZone }) => {
  let resolvedDate = undefined;
  if (extractedParams?.date) {
    resolvedDate = resolveDate(extractedParams.date, timeZone).resolvedDate;
  }

  let resolvedStart = undefined;
  let resolvedEnd = undefined;
  if (extractedParams?.startDate) {
    resolvedStart = resolveDate(extractedParams.startDate, timeZone).resolvedDate;
  }
  if (extractedParams?.endDate) {
    resolvedEnd = resolveDate(extractedParams.endDate, timeZone).resolvedDate;
  }

  const result = await searchManagerAttendance({
    date: resolvedDate,
    startDate: resolvedStart,
    endDate: resolvedEnd,
    month: extractedParams?.month,
    year: extractedParams?.year,
    employeeName: extractedParams?.employeeName,
    status: extractedParams?.status,
    branch: extractedParams?.branch,
    limit: 20,
  });

  if (result.employeeMatchStatus === "NOT_FOUND") {
    return {
      reply: `Employee "${extractedParams.employeeName}" was not found in the directory. Please check the spelling and try again.`,
    };
  }

  if (result.employeeMatchStatus === "AMBIGUOUS") {
    const candidateList = result.matchedEmployees
      .map((e, idx) => `${idx + 1}. **${e.name}** (${e.department || "No Dept"}, ${e.branch || "No Branch"}, ID: ${e.employeeId})`)
      .join("\n");
    return {
      reply: `Multiple employees matched "${extractedParams.employeeName}":\n\n${candidateList}\n\nPlease specify the department, branch, or employee ID.`,
    };
  }

  if (result.count === 0) {
    const filterDesc = [
      extractedParams?.employeeName ? `employee "${extractedParams.employeeName}"` : null,
      extractedParams?.branch ? `branch "${extractedParams.branch}"` : null,
      resolvedDate ? `date ${resolvedDate}` : null,
      extractedParams?.status ? `status "${extractedParams.status}"` : null,
      extractedParams?.month ? `month ${extractedParams.month}` : null,
    ].filter(Boolean).join(", ");
    return {
      reply: `No attendance records found matching criteria (${filterDesc || "current filters"}).`,
    };
  }

  const header = `Found **${result.count}** matching attendance record(s):\n\n`;
  const lines = result.records.map((r, i) => {
    const empName = r.employee?.name || "Employee";
    const dept = r.employee?.department ? ` (${r.employee.department})` : "";
    const inTime = r.checkInTime ? new Date(r.checkInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
    const outTime = r.checkOutTime ? new Date(r.checkOutTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
    const statusEmoji = r.status === "present" ? "✅" : r.status === "late" ? "⚠️" : r.status === "half-day" ? "🌗" : r.status === "on-leave" ? "🏖️" : "❌";
    return `${i + 1}. **${empName}**${dept} — **${r.date}**\n   • Status: ${statusEmoji} ${r.status.toUpperCase()}\n   • In: ${inTime} | Out: ${outTime} | Work Hours: ${r.workHours || 0}h`;
  });

  return { reply: header + lines.join("\n\n") };
};

/**
 * ATTENDANCE:GET_EMPLOYEE_DETAILS_MANAGER Handler
 * Retrieves detailed record and working hours for an employee on a target date.
 */
const handleAttendanceGetEmployeeDetailsManagerIntent = async ({ extractedParams, timeZone }) => {
  if (!extractedParams?.employeeName) {
    return { reply: "Please specify which employee you would like attendance details for." };
  }

  let resolvedDate = undefined;
  if (extractedParams?.date) {
    resolvedDate = resolveDate(extractedParams.date, timeZone).resolvedDate;
  }

  const result = await getManagerAttendanceDetails({
    employeeName: extractedParams.employeeName,
    date: resolvedDate,
  });

  if (result.employeeMatchStatus === "NOT_FOUND") {
    return { reply: result.message };
  }

  if (result.employeeMatchStatus === "AMBIGUOUS") {
    const candidateList = result.matchedEmployees
      .map((e, idx) => `${idx + 1}. **${e.name}** (${e.department || "No Dept"}, ${e.branch || "No Branch"}, ID: ${e.employeeId})`)
      .join("\n");
    return {
      reply: `Multiple employees matched "${extractedParams.employeeName}":\n\n${candidateList}\n\nPlease specify the department or employee ID.`,
    };
  }

  if (!result.found) {
    return { reply: result.message };
  }

  const emp = result.employee;
  const rec = result.record;
  const inTime = rec.checkInTime ? new Date(rec.checkInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Not logged";
  const outTime = rec.checkOutTime ? new Date(rec.checkOutTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : rec.isActiveSession ? "Active session (not checked out)" : "Not logged";

  let sessionStatus = "Completed";
  if (rec.isActiveSession) sessionStatus = "Currently Checked In (Active Session)";

  return {
    reply:
      `### Attendance Details: **${emp.name}**\n\n` +
      `• **Date**: ${rec.date}\n` +
      `• **Employee ID**: ${emp.employeeId}\n` +
      `• **Department**: ${emp.department || "N/A"} (${emp.branch || "N/A"})\n` +
      `• **Status**: ${rec.status.toUpperCase()}\n` +
      `• **Check-In**: ${inTime}\n` +
      `• **Check-Out**: ${outTime}\n` +
      `• **Work Hours**: ${rec.workHours} hours\n` +
      `• **Session State**: ${sessionStatus}`,
  };
};

/**
 * ATTENDANCE:GET_DAILY_SUMMARY_MANAGER Handler
 * Reports grounded daily team attendance summary with distinct metrics.
 */
const handleAttendanceGetDailySummaryManagerIntent = async ({ extractedParams, timeZone }) => {
  let resolvedDate = undefined;
  if (extractedParams?.date) {
    resolvedDate = resolveDate(extractedParams.date, timeZone).resolvedDate;
  }

  const result = await getManagerDailyAttendanceSummary({
    date: resolvedDate,
    branch: extractedParams?.branch,
  });

  return {
    reply:
      `### Daily Attendance Summary for **${result.date}** (${result.branch})\n\n` +
      `• **Total Active Roster**: **${result.totalEmployees}** employee(s)\n` +
      `• **Checked In**: **${result.checkedIn}** (Currently Active: **${result.currentlyCheckedIn}**, Checked Out: **${result.checkedOut}**)\n` +
      `• **Late Arrivals**: **${result.late}**\n` +
      `• **Half-Day**: **${result.halfDay}**\n` +
      `• **On Leave**: **${result.onLeave}**\n` +
      `• **Explicitly Marked Absent**: **${result.markedAbsent}**\n` +
      `• **No Attendance Record**: **${result.noRecord}**\n\n` +
      `*Note: Counters reflect distinct tracked states and are not mutually exclusive.*`,
  };
};

/**
 * ATTENDANCE:GET_MONTHLY_SUMMARY_MANAGER Handler
 * Reports monthly attendance summary with explicit denominators.
 */
const handleAttendanceGetMonthlySummaryManagerIntent = async ({ extractedParams, timeZone }) => {
  const result = await getManagerMonthlyAttendanceSummary({
    month: extractedParams?.month,
    year: extractedParams?.year,
    branch: extractedParams?.branch,
    employeeName: extractedParams?.employeeName,
  });

  if (result.employeeMatchStatus === "NOT_FOUND") {
    return { reply: result.message };
  }

  if (result.employeeMatchStatus === "AMBIGUOUS") {
    const candidateList = result.matchedEmployees
      .map((e, idx) => `${idx + 1}. **${e.name}** (${e.department || "No Dept"}, ${e.branch || "No Branch"}, ID: ${e.employeeId})`)
      .join("\n");
    return {
      reply: `Multiple employees matched "${extractedParams.employeeName}":\n\n${candidateList}\n\nPlease specify the department or employee ID.`,
    };
  }

  if (result.scope === "INDIVIDUAL") {
    const emp = result.employee;
    return {
      reply:
        `### Monthly Attendance Summary: **${emp.name}** (${result.month}/${result.year})\n\n` +
        `• **Present Days**: **${result.present}**\n` +
        `• **Late Days**: **${result.late}**\n` +
        `• **Half-Day Days**: **${result.halfDay}**\n` +
        `• **On Leave**: **${result.onLeave}**\n` +
        `• **Total Work Hours**: **${result.totalWorkHours}** hours\n` +
        `• **Average Work Hours / Day Worked**: **${result.avgWorkHours}** hours/day\n` +
        `• *Calculation Denominator: ${result.workedDays} days where check-in occurred.*`,
    };
  }

  return {
    reply:
      `### Team Monthly Attendance Summary (${result.month}/${result.year} — ${result.branch})\n\n` +
      `• **Total Employees in Roster**: **${result.totalEmployeesInRoster}**\n` +
      `• **Employees Attended (Active Sessions)**: **${result.uniqueEmployeesAttended}**\n` +
      `• **Total Worked Sessions**: **${result.totalWorkedSessions}**\n` +
      `• **Total Work Hours**: **${result.totalWorkHours}** hours\n` +
      `• **Average Hours per Worked Session**: **${result.avgWorkHoursPerSession}** hours\n` +
      `• **Late Arrivals**: **${result.totalLate}**\n` +
      `• **Half-Days**: **${result.totalHalfDay}**\n` +
      `• **On Leave Instances**: **${result.totalOnLeave}**\n` +
      `• *Calculation Denominator: ${result.workHoursDenominator}.*`,
  };
};

/**
 * ATTENDANCE:GET_NOT_CHECKED_IN_MANAGER Handler
 * Lists roster employees who have not checked in for the target date.
 */
const handleAttendanceGetNotCheckedInManagerIntent = async ({ extractedParams, timeZone }) => {
  let resolvedDate = undefined;
  if (extractedParams?.date) {
    resolvedDate = resolveDate(extractedParams.date, timeZone).resolvedDate;
  }

  const result = await getManagerNotCheckedIn({
    date: resolvedDate,
    branch: extractedParams?.branch,
  });

  if (result.notCheckedInCount === 0) {
    return {
      reply: `All active employees in the roster (**${result.totalRoster}**) have checked in for **${result.date}** (${result.branch})!`,
    };
  }

  const header = `For **${result.date}** (${result.branch}), **${result.notCheckedInCount}** out of **${result.totalRoster}** employee(s) have not checked in:\n\n`;

  const lines = result.employees.map((e, idx) => {
    return `${idx + 1}. **${e.name}** (${e.department || "No Dept"}, ID: ${e.employeeId}) — *${e.statusLabel}*`;
  });

  const note = `\n\n*Note: "No attendance record" indicates the employee has not punched in today; absence is not inferred without an authoritative absent record.*`;

  return { reply: header + lines.join("\n") + note };
};

/**
 * LEAVE:GET_ALL_MANAGER Handler
 */
const handleLeaveGetAllManagerIntent = async ({ req, extractedParams }) => {
  const res = await executeSearchManagerLeaves(extractedParams || {}, { user: req.user });
  if (res.error) {
    return { reply: res.message || "Failed to retrieve enterprise leave requests." };
  }

  if (res.count === 0) {
    return { reply: "There are currently no leave requests on file across the organization." };
  }

  const lines = res.leaves.slice(0, 10).map((l, idx) => {
    const emp = l.employeeId || {};
    const empName = emp.name || "Unknown";
    const dept = emp.department ? ` (${emp.department})` : "";
    const typeCap = l.leaveType ? l.leaveType.charAt(0).toUpperCase() + l.leaveType.slice(1) : "Leave";
    const statusCap = (l.status || "PENDING").toUpperCase();
    return `${idx + 1}. **${empName}**${dept}: **${typeCap} Leave** (${l.startDate} → ${l.endDate}, ${l.totalDays} day${l.totalDays !== 1 ? "s" : ""}) — **${statusCap}**`;
  });

  const header = `Here are recent enterprise leave requests (**${res.count}** total):\n\n`;
  const footer = res.count > 10 ? `\n\n*Showing top 10 of ${res.count} requests. Filter by employee, date, or status for more.*` : "";

  return { reply: header + lines.join("\n") + footer };
};

/**
 * LEAVE:SEARCH_MANAGER Handler
 */
const handleLeaveSearchManagerIntent = async ({ req, extractedParams }) => {
  const res = await executeSearchManagerLeaves(extractedParams || {}, { user: req.user });
  if (res.error) {
    return { reply: res.message || "Failed to search leave requests." };
  }

  if (res.employeeMatchStatus === "NOT_FOUND") {
    return { reply: res.message || "Could not find an employee matching that name." };
  }

  if (res.employeeMatchStatus === "AMBIGUOUS") {
    const list = (res.matchedEmployees || [])
      .map((e) => `- **${e.name}** (${e.department || "No Dept"}, ID: ${e.employeeId}, Branch: ${e.branch || "—"})`)
      .join("\n");
    return {
      reply: `Multiple employees matched your search. Please specify employee ID or department:\n\n${list}`,
    };
  }

  if (res.count === 0) {
    return { reply: "No leave requests matched your search criteria." };
  }

  const lines = res.leaves.map((l, idx) => {
    const emp = l.employeeId || {};
    const empName = emp.name || "Unknown";
    const dept = emp.department ? ` (${emp.department})` : "";
    const typeCap = l.leaveType ? l.leaveType.charAt(0).toUpperCase() + l.leaveType.slice(1) : "Leave";
    const statusCap = (l.status || "PENDING").toUpperCase();
    let line = `${idx + 1}. **${empName}**${dept}: **${typeCap} Leave** (${l.startDate} → ${l.endDate}, ${l.totalDays} day${l.totalDays !== 1 ? "s" : ""}) — **${statusCap}**`;
    if (l.reason) line += `\n   - Reason: ${l.reason}`;
    if (l.reviewNotes && l.status === "rejected") line += `\n   - Rejection Note: ${l.reviewNotes}`;
    return line;
  });

  const header = `Found **${res.count}** matching leave request(s):\n\n`;
  return { reply: header + lines.join("\n") };
};

/**
 * LEAVE:GET_REQUEST_DETAILS_MGR Handler
 */
const handleLeaveGetRequestDetailsManagerIntent = async ({ req, extractedParams }) => {
  const res = await executeGetManagerLeaveDetails(extractedParams || {}, { user: req.user });
  if (res.error) {
    return { reply: res.message || "Failed to retrieve leave request details." };
  }

  if (!res.found) {
    if (res.ambiguous) {
      const list = (res.candidates || [])
        .map(
          (c) =>
            `- **${c.leaveType.toUpperCase()} Leave** (${c.startDate} → ${c.endDate}, ${c.totalDays} days) — **${c.status.toUpperCase()}** (ID: \`${c.leaveId}\`)`
        )
        .join("\n");
      return {
        reply: `Multiple leave requests matched. Please specify by ID:\n\n${list}`,
      };
    }
    return { reply: res.message || "Leave request was not found." };
  }

  const l = res.leave;
  const emp = l.employeeId || {};
  const typeCap = l.leaveType ? l.leaveType.charAt(0).toUpperCase() + l.leaveType.slice(1) : "Leave";
  const statusCap = (l.status || "PENDING").toUpperCase();

  let details = `### Leave Request Details: \`${l._id}\`\n\n`;
  details += `- **Employee**: ${emp.name || "Unknown"} (ID: ${emp.employeeId || "—"}, Dept: ${emp.department || "—"}, Branch: ${emp.branch || "—"})\n`;
  details += `- **Leave Type**: ${typeCap}\n`;
  details += `- **Dates**: ${l.startDate} to ${l.endDate} (${l.totalDays} business day${l.totalDays !== 1 ? "s" : ""})\n`;
  if (l.isHalfDay) {
    details += `- **Half Day**: Yes (${l.halfDayPeriod || "Unspecified"})\n`;
  }
  details += `- **Status**: **${statusCap}**\n`;
  details += `- **Reason**: ${l.reason || "None provided"}\n`;

  if (l.reviewedBy) {
    const reviewerName = typeof l.reviewedBy === "object" ? l.reviewedBy.name : "Manager";
    details += `- **Reviewed By**: ${reviewerName}\n`;
    if (l.reviewedAt) {
      details += `- **Reviewed At**: ${new Date(l.reviewedAt).toLocaleDateString()}\n`;
    }
  }
  if (l.reviewNotes) {
    details += `- **Review Notes**: ${l.reviewNotes}\n`;
  }

  return { reply: details };
};

/**
 * LEAVE:GET_BALANCES_MGR Handler
 */
const handleLeaveGetBalancesManagerIntent = async ({ req, extractedParams }) => {
  const res = await executeGetManagerLeaveBalances(extractedParams || {}, { user: req.user });
  if (res.error) {
    return { reply: res.message || "Failed to retrieve leave balances." };
  }

  if (res.employeeMatchStatus === "NOT_FOUND") {
    return { reply: res.message || "Could not find an employee matching that name." };
  }

  if (res.employeeMatchStatus === "AMBIGUOUS") {
    const list = (res.matchedEmployees || [])
      .map((e) => `- **${e.name}** (${e.department || "No Dept"}, ID: ${e.employeeId}, Branch: ${e.branch || "—"})`)
      .join("\n");
    return {
      reply: `Multiple employees matched your search. Please specify employee ID or department:\n\n${list}`,
    };
  }

  if (res.scope === "INDIVIDUAL") {
    const emp = res.employee || {};
    const bData = res.balances || {};
    const lines = LEAVE_TYPES.map((type) => {
      const q = bData[type];
      if (!q) return null;
      const typeCap = type.charAt(0).toUpperCase() + type.slice(1);
      if (q.total >= 999) {
        return `- **${typeCap}**: Unlimited (Used: ${q.used} days)`;
      }
      return `- **${typeCap}**: **${q.remaining} days remaining** (${q.used} used, ${q.pending} pending of ${q.total} total)`;
    }).filter(Boolean);

    const reply = `**Leave Balances for ${emp.name}** (${emp.department || "No Dept"}, ID: ${emp.employeeId || "—"}) for **${res.year}**:\n\n${lines.join("\n")}`;
    return { reply };
  }

  // TEAM / ROSTER OVERVIEW
  if (res.totalEmployees === 0) {
    return { reply: "No active employees found in the organization roster." };
  }

  const lines = (res.employeeBalances || []).map((eb, idx) => {
    const emp = eb.employee || {};
    const b = eb.balances || {};
    const casualRem = b.casual ? b.casual.remaining : 0;
    const sickRem = b.sick ? b.sick.remaining : 0;
    const earnedRem = b.earned ? b.earned.remaining : 0;
    return `${idx + 1}. **${emp.name}** (${emp.department || "No Dept"}, ID: ${emp.employeeId}): Casual: ${casualRem}d, Sick: ${sickRem}d, Earned: ${earnedRem}d remaining`;
  });

  const header = `**Enterprise Leave Balances Summary (${res.year} - ${res.branch})** — **${res.totalEmployees}** employee(s):\n\n`;
  const footer = `\n\n*To see full quotas for a specific employee, ask "Show leave balance for [Name]".*`;
  return { reply: header + lines.join("\n") + footer };
};

/**
 * LEAVE:GET_ACTIVE_TODAY Handler
 */
const handleLeaveGetActiveTodayIntent = async ({ req, extractedParams }) => {
  const res = await executeGetManagerActiveLeavesToday(extractedParams || {}, { user: req.user });
  if (res.error) {
    return { reply: res.message || "Failed to check active leaves." };
  }

  if (res.count === 0) {
    return {
      reply: `No employees are on approved leave on **${res.date}** (${res.branch}).`,
    };
  }

  const lines = res.leaves.map((l, idx) => {
    const emp = l.employeeId || {};
    const empName = emp.name || "Unknown";
    const dept = emp.department ? ` (${emp.department}, ID: ${emp.employeeId})` : "";
    const typeCap = l.leaveType ? l.leaveType.charAt(0).toUpperCase() + l.leaveType.slice(1) : "Leave";
    return `${idx + 1}. **${empName}**${dept} — **${typeCap} Leave** (${l.startDate} → ${l.endDate}, ${l.totalDays} days)`;
  });

  const header = `For **${res.date}** (${res.branch}), **${res.count}** employee(s) are on approved leave:\n\n`;
  const note = `\n\n*Note: Only approved leaves are considered active leaves.*`;

  return { reply: header + lines.join("\n") + note };
};

/**
 * GENERAL:HELP Handler
 */
const handleGeneralHelpIntent = async ({ aiResult }) => {
  return {
    reply:
      aiResult?.reply ||
      "How can I help you today? I can help you search for meeting rooms, book a room, view your upcoming reservations, check attendance, manage leave requests, view notifications, check your profile, or navigate the application.",
  };
};

const CAPABILITY_HANDLERS = Object.freeze({
  "BOOKING:BOOK": handleBookingBookIntent,
  "BOOKING:SEARCH": handleBookingSearchIntent,
  "BOOKING:MY_BOOKINGS": handleBookingMyBookingsIntent,
  "BOOKING:CANCEL": handleBookingCancelIntent,
  "BOOKING:GET_NEXT": handleBookingGetNextIntent,
  "BOOKING:GET_UPCOMING": handleBookingGetUpcomingIntent,
  "BOOKING:GET_DETAILS": handleBookingGetDetailsIntent,
  "BOOKING:GET_STATUS": handleBookingGetStatusIntent,
  "BOOKING:GET_ALL": handleBookingGetAllIntent,
  "BOOKING:SEARCH_MANAGER": handleBookingSearchManagerIntent,
  "BOOKING:GET_DETAILS_MGR": handleBookingGetDetailsManagerIntent,
  "ROOM:GET_AVAILABILITY_MGR": handleRoomGetAvailabilityManagerIntent,
  "ROOM:GET_UTILIZATION_MGR": handleRoomGetUtilizationManagerIntent,
  "ATTENDANCE:GET_TODAY": handleAttendanceGetToday,
  "ATTENDANCE:GET_BY_DATE": handleAttendanceGetByDate,
  "ATTENDANCE:GET_SUMMARY": handleAttendanceGetSummary,
  "ATTENDANCE:GET_MY_SUMMARY": handleAttendanceGetSummary,
  "ATTENDANCE:GET_HISTORY": handleAttendanceGetHistory,
  "ATTENDANCE:PUNCH_IN": handleAttendancePunchIn,
  "ATTENDANCE:PUNCH_OUT": handleAttendancePunchOut,
  "ATTENDANCE:GET_ALL_MANAGER": handleAttendanceGetAllManagerIntent,
  "ATTENDANCE:SEARCH_MANAGER": handleAttendanceSearchManagerIntent,
  "ATTENDANCE:GET_EMPLOYEE_DETAILS_MANAGER": handleAttendanceGetEmployeeDetailsManagerIntent,
  "ATTENDANCE:GET_DAILY_SUMMARY_MANAGER": handleAttendanceGetDailySummaryManagerIntent,
  "ATTENDANCE:GET_MONTHLY_SUMMARY_MANAGER": handleAttendanceGetMonthlySummaryManagerIntent,
  "ATTENDANCE:GET_NOT_CHECKED_IN_MANAGER": handleAttendanceGetNotCheckedInManagerIntent,
  "LEAVE:GET_BALANCE": handleLeaveGetBalance,
  "LEAVE:GET_MY_REQUESTS": handleLeaveGetMyRequests,
  "LEAVE:GET_REQUEST_DETAILS": handleLeaveGetRequestDetails,
  "LEAVE:CHECK_ELIGIBILITY": handleLeaveCheckEligibility,
  "LEAVE:APPLY": handleLeaveApply,
  "LEAVE:GET_ALL_MANAGER": handleLeaveGetAllManagerIntent,
  "LEAVE:SEARCH_MANAGER": handleLeaveSearchManagerIntent,
  "LEAVE:GET_REQUEST_DETAILS_MGR": handleLeaveGetRequestDetailsManagerIntent,
  "LEAVE:GET_BALANCES_MGR": handleLeaveGetBalancesManagerIntent,
  "LEAVE:GET_ACTIVE_TODAY": handleLeaveGetActiveTodayIntent,
  "NOTIFICATION:GET_MY_NOTIFICATIONS": handleNotificationGetMy,
  "NOTIFICATION:GET_UNREAD": handleNotificationGetUnread,
  "NOTIFICATION:GET_NOTIFICATION_DETAILS": handleNotificationGetDetails,
  "PROFILE:GET_MY_PROFILE": handleProfileGetMy,
  "NAVIGATION:OPEN_EMPLOYEE_PAGE": handleNavigationOpen,
  "NAVIGATION:OPEN_MGR_PAGE": handleNavigationOpenManagerPage,
  "GENERAL:HELP": handleGeneralHelpIntent,
});

