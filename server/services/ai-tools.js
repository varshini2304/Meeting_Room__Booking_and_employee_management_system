import {
  getMyNextBooking,
  getMyUpcomingBookings,
  findMyBookingsByDateTime,
  getMyBookingDetails,
  searchManagerBookings,
  getManagerBookingDetails,
  findManagerBookingsByCriteria,
} from "./booking.service.js";
import {
  getRoomAvailabilityService,
  getRoomUtilizationService,
} from "./room.service.js";
import { Attendance } from "../models/attendance.model.js";
import { Leave } from "../models/leave.model.js";
import {
  getUserNotifications,
  getUserUnreadNotifications,
  getUserNotificationDetails,
} from "./notification.service.js";
import { getUserProfileService } from "./user.service.js";
import { findAndRankAvailableRooms } from "./room-ranking.service.js";
import { resolveBranchTimezone } from "../config/timezones.js";
import { resolveDate, resolveTime, validateSlotTiming } from "../utils/dateTimeResolver.js";
import {
  getTodayRecord,
  getMyHistory,
  getMonthlySummary,
  getTodayDateStr,
  searchManagerAttendance,
  getManagerAttendanceDetails,
  getManagerDailyAttendanceSummary,
  getManagerMonthlyAttendanceSummary,
  getManagerNotCheckedIn,
} from "./attendance.service.js";
import {
  getMyBalance,
  getMyLeaves,
  LEAVE_TYPES,
  searchManagerLeaves,
  getManagerActiveLeavesOnDate,
  getManagerLeaveDetails,
  getManagerLeaveBalances,
} from "./leave.service.js";

/**
 * Strict, read-only tool specifications for the LLM.
 * Notice: Zero write permissions. No tools for create, cancel, confirm, or modify.
 */
export const READ_ONLY_AI_TOOLS = Object.freeze([
  {
    type: "function",
    function: {
      name: "search_available_rooms",
      description:
        "Search and rank available meeting rooms matching capacity, date, time slot, and required amenities. All requested amenities are hard non-negotiable constraints.",
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "Target meeting date in YYYY-MM-DD or relative like 'today' or 'tomorrow'",
          },
          startTime: {
            type: "string",
            description: "Start time on 30-minute boundary, e.g., '14:00' or '14:30'",
          },
          endTime: {
            type: "string",
            description: "End time on 30-minute boundary, e.g., '14:30' or '15:00'",
          },
          attendeeCount: {
            type: "number",
            description: "Number of attendees required for the meeting",
          },
          capacity: {
            type: "number",
            description: "Desired minimum room capacity",
          },
          roomType: {
            type: "string",
            description: "Desired room type, e.g. 'Conference Room' or 'Meeting Room'",
          },
          amenities: {
            type: "array",
            items: { type: "string" },
            description: "Strict non-negotiable required amenities (e.g., 'Whiteboard', 'Projector')",
          },
          branch: {
            type: "string",
            description: "Toyota enterprise branch (e.g., 'Bangalore', 'Hyderabad', 'Chennai')",
          },
        },
        required: ["date", "startTime", "endTime"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_my_bookings",
      description: "Retrieve upcoming active room reservations for the authenticated user.",
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "Optional target date in YYYY-MM-DD format or relative like 'today' or 'tomorrow'",
          },
          limit: {
            type: "number",
            description: "Maximum number of upcoming bookings to return (default 10)",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_booking_details",
      description: "Retrieve details for a specific reservation belonging to the authenticated user.",
      parameters: {
        type: "object",
        properties: {
          bookingId: {
            type: "string",
            description: "The unique ID of the booking to retrieve",
          },
        },
        required: ["bookingId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_my_next_booking",
      description: "Retrieve the next strictly-future upcoming meeting for the authenticated employee.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_my_attendance",
      description: "Retrieve attendance punch-in, punch-out, work hours, and status for the authenticated user on a specific date.",
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "Target date in YYYY-MM-DD format or relative like 'today' or 'yesterday'",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_my_attendance_summary",
      description: "Retrieve monthly attendance summary (total days present, absent, half days, average work hours) for authenticated employee.",
      parameters: {
        type: "object",
        properties: {
          month: {
            type: "number",
            description: "1-12 calendar month (e.g., 9 for September)",
          },
          year: {
            type: "number",
            description: "4-digit year (e.g., 2026)",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_my_attendance_history",
      description: "Retrieve list of historical daily attendance records for authenticated employee across a specific month/year.",
      parameters: {
        type: "object",
        properties: {
          month: {
            type: "number",
            description: "1-12 calendar month",
          },
          year: {
            type: "number",
            description: "4-digit year",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_my_leave_balance",
      description: "Retrieve authoritative leave balances and quotas (casual, sick, earned, menstrual, relocation, unpaid, maternity, paternity) for the authenticated employee.",
      parameters: {
        type: "object",
        properties: {
          year: {
            type: "number",
            description: "Calendar year (default: current year)",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_my_leave_requests",
      description: "Retrieve historical and active leave requests submitted by the authenticated employee.",
      parameters: {
        type: "object",
        properties: {
          year: {
            type: "number",
            description: "Optional calendar year to filter requests",
          },
          status: {
            type: "string",
            enum: ["pending", "approved", "rejected", "cancelled"],
            description: "Optional status filter",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_my_leave_request_details",
      description: "Retrieve details of a specific leave request including manager review remarks, scoped strictly to the authenticated employee.",
      parameters: {
        type: "object",
        properties: {
          leaveId: {
            type: "string",
            description: "Specific leave record ID if known",
          },
          query: {
            type: "string",
            description: "Optional query term or date string to locate the leave request",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_my_notifications",
      description: "Retrieve recent inbox notifications (invites, reminders, system updates) for the authenticated employee.",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Maximum number of recent notifications to retrieve (default: 5, max: 20)",
          },
          isRead: {
            type: "boolean",
            description: "Filter by read status: true for read only, false for unread only, omit for all",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_my_unread_notifications",
      description: "Retrieve all unread notifications and the unread count for the authenticated employee.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_my_notification_details",
      description: "Retrieve specific details of a single notification owned by the authenticated employee.",
      parameters: {
        type: "object",
        properties: {
          notificationId: {
            type: "string",
            description: "The 24-character hexadecimal MongoDB ObjectId of the notification",
          },
          query: {
            type: "string",
            description: "Optional keyword to find the notification by title or message",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_my_profile",
      description: "Retrieve authenticated employee profile information including name, employee ID, role, branch, country, department, and designation.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_manager_bookings",
      description: "Search and filter enterprise bookings across all employees and rooms by date, date range, branch, room number, employee name, status, or start time.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "Target meeting date in YYYY-MM-DD format" },
          startDate: { type: "string", description: "Start of date range in YYYY-MM-DD format" },
          endDate: { type: "string", description: "End of date range in YYYY-MM-DD format" },
          branch: { type: "string", description: "Toyota enterprise branch (e.g. 'Bangalore', 'Hyderabad', 'Chennai')" },
          roomNumber: { type: "string", description: "Room number (e.g. 'A-202', 'B-101')" },
          employeeName: { type: "string", description: "Employee name to search bookings for" },
          status: { type: "string", enum: ["booked", "cancelled", "completed"], description: "Reservation status filter" },
          startTime: { type: "string", description: "Meeting start time (HH:mm)" },
          limit: { type: "number", description: "Maximum bookings to return (default 20, max 50)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_manager_booking_details",
      description: "Retrieve comprehensive details for a specific enterprise booking by explicit booking ID.",
      parameters: {
        type: "object",
        properties: {
          bookingId: { type: "string", description: "The 24-character hexadecimal MongoDB ObjectId of the booking" },
        },
        required: ["bookingId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_manager_room_availability",
      description: "Inspect enterprise room availability and occupancy status for a specific date and time slot, with optional branch filter.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "Target date in YYYY-MM-DD format" },
          startTime: { type: "string", description: "Target start time in HH:mm format" },
          branch: { type: "string", description: "Optional branch filter" },
          roomType: { type: "string", description: "Optional canonical room type ('Meeting Room' or 'Conference Room')" },
        },
        required: ["date", "startTime"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_manager_room_utilization",
      description: "Inspect concrete room reservation and confirmed physical check-in counts within a date range.",
      parameters: {
        type: "object",
        properties: {
          startDate: { type: "string", description: "Start date of evaluation range in YYYY-MM-DD format" },
          endDate: { type: "string", description: "End date of evaluation range in YYYY-MM-DD format" },
          roomNumber: { type: "string", description: "Optional room number filter" },
          branch: { type: "string", description: "Optional branch filter" },
        },
        required: ["startDate", "endDate"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_manager_attendance",
      description: "Search and filter enterprise attendance records across employees by date, date range, month/year, status, employee name, or branch.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "Target date in YYYY-MM-DD format or relative like 'today'" },
          startDate: { type: "string", description: "Start date for range filter in YYYY-MM-DD format" },
          endDate: { type: "string", description: "End date for range filter in YYYY-MM-DD format" },
          month: { type: "number", description: "Month number (1-12)" },
          year: { type: "number", description: "Year (e.g. 2026)" },
          employeeName: { type: "string", description: "Optional employee name to filter" },
          status: { type: "string", description: "Exact status: 'present', 'absent', 'late', 'half-day', or 'on-leave'" },
          branch: { type: "string", description: "Optional branch filter" },
          limit: { type: "number", description: "Maximum records to return (default 25)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_manager_attendance_details",
      description: "Retrieve comprehensive attendance details and work hours for a specific employee on a target date.",
      parameters: {
        type: "object",
        properties: {
          employeeName: { type: "string", description: "Employee name to retrieve attendance details for" },
          date: { type: "string", description: "Target date in YYYY-MM-DD format or relative like 'today'" },
        },
        required: ["employeeName"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_manager_daily_attendance_summary",
      description: "Retrieve daily team attendance summary breakdown including checked in, checked out, currently active, late, half-day, on-leave, marked absent, and no attendance record.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "Target date in YYYY-MM-DD format or relative like 'today'" },
          branch: { type: "string", description: "Optional branch filter" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_manager_monthly_attendance_summary",
      description: "Retrieve monthly attendance summary and working-hour statistics for an employee or the whole team.",
      parameters: {
        type: "object",
        properties: {
          month: { type: "number", description: "Month number (1-12)" },
          year: { type: "number", description: "Year (e.g. 2026)" },
          branch: { type: "string", description: "Optional branch filter" },
          employeeName: { type: "string", description: "Optional employee name for individual summary" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_manager_not_checked_in",
      description: "Identify active employees in the roster who have not checked in for today or a specific date, distinguishing no-record, on-leave, and marked absent.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "Target date in YYYY-MM-DD format or relative like 'today'" },
          branch: { type: "string", description: "Optional branch filter" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_manager_leave_requests",
      description: "Search and filter enterprise leave requests across employees by employee name, status, leave type, date range, or branch.",
      parameters: {
        type: "object",
        properties: {
          employeeName: { type: "string", description: "Optional employee name to filter" },
          status: { type: "string", description: "Status filter: 'pending', 'approved', 'rejected', or 'cancelled'" },
          leaveType: { type: "string", description: "Leave type: 'casual', 'sick', 'earned', 'menstrual', 'relocation', 'unpaid', 'maternity', 'paternity'" },
          startDate: { type: "string", description: "Start date in YYYY-MM-DD" },
          endDate: { type: "string", description: "End date in YYYY-MM-DD" },
          date: { type: "string", description: "Date on which leave is active (YYYY-MM-DD or relative like 'today')" },
          startsOnDate: { type: "string", description: "Explicit single start date in YYYY-MM-DD" },
          month: { type: "number", description: "Month number (1-12)" },
          year: { type: "number", description: "Year (e.g. 2026)" },
          branch: { type: "string", description: "Optional branch filter" },
          limit: { type: "number", description: "Maximum records to return (default 25)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_manager_leave_request_details",
      description: "Retrieve comprehensive details for a specific leave request by ID or indirect criteria.",
      parameters: {
        type: "object",
        properties: {
          leaveId: { type: "string", description: "Optional 24-character hexadecimal MongoDB ObjectId of the leave request" },
          employeeName: { type: "string", description: "Optional employee name to filter" },
          leaveType: { type: "string", description: "Optional leave type" },
          date: { type: "string", description: "Optional date in YYYY-MM-DD" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_manager_leave_balances",
      description: "Inspect employee or roster leave quota balances, used days, and remaining days using authoritative calculations.",
      parameters: {
        type: "object",
        properties: {
          employeeName: { type: "string", description: "Optional employee name for individual balance lookup" },
          branch: { type: "string", description: "Optional branch filter" },
          year: { type: "number", description: "Year (defaults to current year)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_manager_active_leaves_today",
      description: "Identify employees on approved leave for today or a specific date.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "Target date in YYYY-MM-DD format or relative like 'today'" },
          branch: { type: "string", description: "Optional branch filter" },
        },
        additionalProperties: false,
      },
    },
  },
]);

/**
 * Executes search_available_rooms using the deterministic timezone and room engine.
 * Never trusts client/LLM to rank or evaluate availability directly.
 *
 * @param {Object} args - Tool arguments from LLM
 * @param {Object} context - Server-side verified context: { user: { _id, branch, country } }
 * @returns {Promise<Object>}
 */
export const executeSearchAvailableRooms = async (args, context) => {
  const user = context?.user || {};
  const requestedBranch = args.branch ? String(args.branch).trim() : user.branch || "";

  // 1. Timezone verification: unknown explicit branch must be rejected/clarified
  const timeZone = resolveBranchTimezone(requestedBranch);
  if (args.branch && timeZone === null) {
    return {
      error: "UNRECOGNIZED_BRANCH",
      message: "Toyota branches currently supported are Bangalore, Hyderabad, and Chennai. Which branch would you like to book in?",
    };
  }

  // 2. Deterministic date resolution
  const dateRes = resolveDate(args.date, timeZone);
  if (dateRes.error || !dateRes.resolvedDate) {
    return {
      error: "INVALID_DATE",
      message: dateRes.error || "Please provide a valid date like 'tomorrow' or 'YYYY-MM-DD'.",
    };
  }

  // 3. Deterministic time resolution (no silent snapping)
  const timeRes = resolveTime(args.startTime);
  if (timeRes.needsClarification) {
    return {
      needsClarification: true,
      clarificationMessage: timeRes.clarificationMessage,
      suggestedSlots: timeRes.suggestedSlots || [],
    };
  }
  if (timeRes.error || !timeRes.resolvedStartTime) {
    return {
      error: "INVALID_TIME",
      message: timeRes.error || "Please provide a valid meeting time.",
    };
  }

  // 4. Validate slot timing against operating hours and past times
  const timingCheck = validateSlotTiming(dateRes.resolvedDate, timeRes.resolvedStartTime, timeZone);
  if (!timingCheck.isValid) {
    return {
      error: "INVALID_TIMING",
      message: timingCheck.error,
    };
  }

  // 5. Deterministic Room Engine (Stage 1 Hard Filter + Stage 2 Ranking)
  const result = await findAndRankAvailableRooms({
    date: dateRes.resolvedDate,
    startTime: timeRes.resolvedStartTime,
    attendeeCount: args.capacity || args.attendeeCount,
    capacity: args.capacity || args.attendeeCount,
    roomType: args.roomType || "",
    requestedAmenities: args.amenities || args.requestedAmenities || [],
    userBranch: requestedBranch,
    requestedBranch,
    userCountry: user.country || "India",
  });

  return {
    success: true,
    resolvedDate: dateRes.resolvedDate,
    resolvedStartTime: timeRes.resolvedStartTime,
    resolvedEndTime: `${timeRes.resolvedStartTime.slice(0, 2)}:${timeRes.resolvedStartTime.endsWith("00") ? "30" : "00"}`, // 30-min slot
    timeZone,
    branch: requestedBranch,
    totalMatches: result.totalAvailableCount,
    candidates: result.candidates,
  };
};

/**
 * Retrieves the authenticated user's active bookings via authoritative booking service.
 * User ID is strictly derived from server context (never from arguments).
 *
 * @param {Object} args - { date?: string, limit?: number }
 * @param {Object} context - { user: { _id, branch } }
 * @returns {Promise<Object>}
 */
export const executeGetMyBookings = async (args, context) => {
  const userId = context?.user?._id;
  if (!userId) {
    return { error: "UNAUTHORIZED", message: "Authenticated user context missing" };
  }

  const timeZone = resolveBranchTimezone(context?.user?.branch) || "Asia/Kolkata";
  const limit = Math.min(Math.max(1, Number(args?.limit) || 10), 20);

  let targetDate = undefined;
  if (args?.date) {
    const dateRes = resolveDate(args.date, timeZone);
    if (dateRes.resolvedDate) {
      targetDate = dateRes.resolvedDate;
    }
  }

  const bookings = await getMyUpcomingBookings({
    userId,
    date: targetDate,
    timeZone,
    limit,
  });

  return {
    success: true,
    count: bookings.length,
    bookings: bookings.map((b) => ({
      bookingId: String(b._id),
      roomNumber: b.roomId?.roomNumber || "Unknown",
      roomType: b.roomId?.roomType || "Meeting Room",
      branch: b.roomId?.branch || "",
      floor: b.roomId?.floor || "",
      date: b.date,
      startTime: b.startTime,
      endTime: b.endTime,
      title: b.title || "",
      status: b.status,
      occupancyConfirmedAt: b.occupancyConfirmedAt,
    })),
  };
};

/**
 * Retrieves the next strictly-future active booking for the authenticated user.
 * Delegates exclusively to authoritative booking service method getMyNextBooking.
 *
 * @param {Object} args
 * @param {Object} context - { user: { _id, branch } }
 * @returns {Promise<Object>}
 */
export const executeGetMyNextBooking = async (args, context) => {
  const userId = context?.user?._id;
  if (!userId) {
    return { error: "UNAUTHORIZED", message: "Authenticated user context missing" };
  }

  const timeZone = resolveBranchTimezone(context?.user?.branch) || "Asia/Kolkata";
  const booking = await getMyNextBooking({ userId, timeZone });

  if (!booking) {
    return {
      success: true,
      hasMeeting: false,
      message: "You have no upcoming meetings scheduled.",
      nextBooking: null,
    };
  }

  return {
    success: true,
    hasMeeting: true,
    nextBooking: {
      bookingId: String(booking._id),
      roomNumber: booking.roomId?.roomNumber || "Unknown",
      roomType: booking.roomId?.roomType || "Meeting Room",
      capacity: booking.roomId?.capacity,
      branch: booking.roomId?.branch || "",
      block: booking.roomId?.block || "",
      floor: booking.roomId?.floor || "",
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      title: booking.title || "Meeting",
      status: booking.status,
      occupancyConfirmedAt: booking.occupancyConfirmedAt,
    },
  };
};

/**
 * Retrieves details for a specific booking belonging to the authenticated user.
 * Delegates exclusively to authoritative booking service method getMyBookingDetails.
 *
 * @param {Object} args - { bookingId }
 * @param {Object} context - { user: { _id } }
 * @returns {Promise<Object>}
 */
export const executeGetBookingDetails = async (args, context) => {
  const userId = context?.user?._id;
  if (!userId) {
    return { error: "UNAUTHORIZED", message: "Authenticated user context missing" };
  }

  if (!args?.bookingId) {
    return { error: "INVALID_REQUEST", message: "bookingId is required" };
  }

  try {
    const booking = await getMyBookingDetails({ bookingId: args.bookingId, userId });
    return {
      success: true,
      booking: {
        bookingId: String(booking._id),
        roomNumber: booking.roomId?.roomNumber || "Unknown",
        roomType: booking.roomId?.roomType || "Meeting Room",
        capacity: booking.roomId?.capacity,
        branch: booking.roomId?.branch || "",
        block: booking.roomId?.block || "",
        floor: booking.roomId?.floor || "",
        amenities: booking.roomId?.amenities || [],
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        title: booking.title || "",
        status: booking.status,
        occupancyConfirmedAt: booking.occupancyConfirmedAt,
      },
    };
  } catch (err) {
    return {
      error: err.statusCode === 403 ? "FORBIDDEN" : "NOT_FOUND",
      message: err.message || "Booking not found",
    };
  }
};

import { isCapabilityAuthorized } from "./ai-capabilities.js";

/**
 * Modular Domain Tool Registry
 * Maps allowed read-only query tools to their domain, capability key, definition, and handler.
 */
const TOOL_REGISTRY = new Map();

/**
 * Registers an authorized read-only tool into the registry.
 * Disallows generic database tools or write tools.
 */
export const registerAiTool = ({ name, domain, capability, definition, execute }) => {
  if (!name || typeof name !== "string") throw new Error("Tool name is required");
  if (!domain || typeof domain !== "string") throw new Error("Tool domain is required");
  if (!execute || typeof execute !== "function") throw new Error("Tool execute function is required");

  // Anti-generic security guard: prohibit generic database queries
  const forbiddenPatterns = ["database", "sql", "query", "mongo", "run_command", "eval", "raw"];
  const lower = name.toLowerCase();
  if (forbiddenPatterns.some((p) => lower.includes(p) && !lower.includes("booking"))) {
    throw new Error(`Tool name '${name}' violates safety policy: generic query tools are prohibited.`);
  }

  TOOL_REGISTRY.set(name, {
    domain,
    capability: capability || `${domain}:READ`,
    definition,
    execute,
  });
};

// Register initial 3 read-only booking query tools
registerAiTool({
  name: "search_available_rooms",
  domain: "BOOKING",
  capability: "BOOKING:SEARCH",
  definition: READ_ONLY_AI_TOOLS[0],
  execute: executeSearchAvailableRooms,
});

registerAiTool({
  name: "get_my_bookings",
  domain: "BOOKING",
  capability: "BOOKING:MY_BOOKINGS",
  definition: READ_ONLY_AI_TOOLS[1],
  execute: executeGetMyBookings,
});

registerAiTool({
  name: "get_booking_details",
  domain: "BOOKING",
  capability: "BOOKING:GET_DETAILS",
  definition: READ_ONLY_AI_TOOLS.find((t) => t.function.name === "get_booking_details"),
  execute: executeGetBookingDetails,
});

registerAiTool({
  name: "get_my_next_booking",
  domain: "BOOKING",
  capability: "BOOKING:GET_NEXT",
  definition: READ_ONLY_AI_TOOLS.find((t) => t.function.name === "get_my_next_booking"),
  execute: executeGetMyNextBooking,
});

/**
 * Retrieves the authenticated employee's attendance record for today, yesterday, or a specific date.
 * Validates ownership server-side from context.
 *
 * @param {Object} args - { date?: string }
 * @param {Object} context - { user: { _id, branch } }
 * @returns {Promise<Object>}
 */
export const executeGetMyAttendance = async (args, context) => {
  const userId = context?.user?._id;
  if (!userId) {
    return { error: "UNAUTHORIZED", message: "Authenticated user context missing" };
  }

  const timeZone = resolveBranchTimezone(context?.user?.branch) || "Asia/Kolkata";
  const now = new Date();
  let targetDate = getTodayDateStr();

  const rawDate = String(args?.date || "").trim().toLowerCase();
  if (rawDate === "yesterday") {
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const pad = (n) => String(n).padStart(2, "0");
    targetDate = `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}`;
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    targetDate = rawDate;
  }

  const record = await Attendance.findOne({ employeeId: userId, date: targetDate }).lean();

  const formatPunchTime = (dateObj) => {
    if (!dateObj) return null;
    return new Date(dateObj).toLocaleTimeString("en-IN", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  return {
    success: true,
    date: targetDate,
    status: record?.status || "absent",
    checkInTime: formatPunchTime(record?.checkInTime),
    checkOutTime: formatPunchTime(record?.checkOutTime),
    workHours: record?.workHours || 0,
    isPunchedIn: Boolean(record?.checkInTime),
    isPunchedOut: Boolean(record?.checkOutTime),
    location: record?.location || "",
  };
};

/**
 * Retrieves monthly attendance statistics for the authenticated employee.
 * Authoritative summary calculated deterministically by server.
 *
 * @param {Object} args - { month?: number, year?: number }
 * @param {Object} context - { user: { _id } }
 * @returns {Promise<Object>}
 */
export const executeGetMyAttendanceSummary = async (args, context) => {
  const userId = context?.user?._id;
  if (!userId) {
    return { error: "UNAUTHORIZED", message: "Authenticated user context missing" };
  }

  const now = new Date();
  const month = Number(args?.month) || now.getMonth() + 1;
  const year = Number(args?.year) || now.getFullYear();

  const summary = await getMonthlySummary({ userId, month, year });

  return {
    success: true,
    month,
    year,
    present: summary.present,
    absent: summary.absent,
    late: summary.late,
    halfDay: summary.halfDay,
    onLeave: summary.onLeave,
    totalWorkHours: summary.totalWorkHours,
    avgWorkHours: summary.avgWorkHours,
    recordCount: summary.records?.length || 0,
  };
};

/**
 * Retrieves recent attendance records or date range history for the authenticated employee.
 *
 * @param {Object} args - { month?: number, year?: number, fromDate?: string, toDate?: string }
 * @param {Object} context - { user: { _id, branch } }
 * @returns {Promise<Object>}
 */
export const executeGetMyAttendanceHistory = async (args, context) => {
  const userId = context?.user?._id;
  if (!userId) {
    return { error: "UNAUTHORIZED", message: "Authenticated user context missing" };
  }

  let records = [];
  if (args?.fromDate && args?.toDate) {
    records = await Attendance.find({
      employeeId: userId,
      date: { $gte: args.fromDate, $lte: args.toDate },
    })
      .sort({ date: 1 })
      .lean();
  } else {
    const now = new Date();
    const month = Number(args?.month) || now.getMonth() + 1;
    const year = Number(args?.year) || now.getFullYear();
    records = await getMyHistory({ userId, month, year });
  }

  const timeZone = resolveBranchTimezone(context?.user?.branch) || "Asia/Kolkata";
  const formatPunchTime = (dateObj) => {
    if (!dateObj) return null;
    return new Date(dateObj).toLocaleTimeString("en-IN", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  return {
    success: true,
    count: records.length,
    records: records.map((r) => ({
      date: r.date,
      status: r.status,
      checkInTime: formatPunchTime(r.checkInTime),
      checkOutTime: formatPunchTime(r.checkOutTime),
      workHours: r.workHours || 0,
    })),
  };
};

registerAiTool({
  name: "get_my_attendance",
  domain: "ATTENDANCE",
  capability: "ATTENDANCE:GET_TODAY",
  definition: READ_ONLY_AI_TOOLS.find((t) => t.function.name === "get_my_attendance"),
  execute: executeGetMyAttendance,
});

registerAiTool({
  name: "get_my_attendance_summary",
  domain: "ATTENDANCE",
  capability: "ATTENDANCE:GET_SUMMARY",
  definition: READ_ONLY_AI_TOOLS.find((t) => t.function.name === "get_my_attendance_summary"),
  execute: executeGetMyAttendanceSummary,
});

registerAiTool({
  name: "get_my_attendance_history",
  domain: "ATTENDANCE",
  capability: "ATTENDANCE:GET_HISTORY",
  definition: READ_ONLY_AI_TOOLS.find((t) => t.function.name === "get_my_attendance_history"),
  execute: executeGetMyAttendanceHistory,
});

/**
 * Retrieves the authenticated employee's authoritative leave balance quotas and remaining days.
 * Strictly uses context.user._id; ignores any injected employeeId.
 */
export const executeGetMyLeaveBalance = async (args, context) => {
  const userId = context?.user?._id;
  if (!userId) {
    return { error: "UNAUTHORIZED", message: "Authenticated user identity required." };
  }

  const year = Number(args?.year) || new Date().getFullYear();
  const balance = await getMyBalance(userId, year);

  return {
    success: true,
    year: balance.year,
    balances: LEAVE_TYPES.map((type) => ({
      type,
      total: balance[type]?.total ?? 0,
      used: balance[type]?.used ?? 0,
      pending: balance[type]?.pending ?? 0,
      remaining: balance[type]?.remaining ?? 0,
    })),
  };
};

/**
 * Retrieves the authenticated employee's leave requests history.
 * Strictly queries leaves belonging to context.user._id.
 */
export const executeGetMyLeaveRequests = async (args, context) => {
  const userId = context?.user?._id;
  if (!userId) {
    return { error: "UNAUTHORIZED", message: "Authenticated user identity required." };
  }

  const year = args?.year ? Number(args.year) : undefined;
  const status = args?.status ? String(args.status).toLowerCase().trim() : undefined;

  const leaves = await getMyLeaves(userId, { year, status });

  return {
    success: true,
    count: leaves.length,
    requests: leaves.slice(0, 10).map((l) => ({
      leaveId: l._id,
      leaveType: l.leaveType,
      startDate: l.startDate,
      endDate: l.endDate,
      totalDays: l.totalDays,
      status: l.status,
      reason: l.reason,
      isHalfDay: Boolean(l.isHalfDay),
      reviewNotes: l.reviewNotes || "",
      createdAt: l.createdAt,
    })),
  };
};

/**
 * Retrieves specific leave request details and manager review/rejection notes.
 * Strictly enforces user ownership by querying { _id: leaveId, employeeId: userId }.
 */
export const executeGetMyLeaveRequestDetails = async (args, context) => {
  const userId = context?.user?._id;
  if (!userId) {
    return { error: "UNAUTHORIZED", message: "Authenticated user identity required." };
  }

  let leave = null;
  if (args?.leaveId) {
    // Security check: strictly scope lookup to authenticated employee
    leave = await Leave.findOne({ _id: args.leaveId, employeeId: userId }).lean();
  }

  if (!leave && args?.query) {
    const q = String(args.query).trim();
    leave = await Leave.findOne({
      employeeId: userId,
      $or: [
        { startDate: q },
        { endDate: q },
        { leaveType: q.toLowerCase() },
        { status: q.toLowerCase() },
      ],
    }).sort({ createdAt: -1 }).lean();
  }

  if (!leave) {
    // Return latest leave request if no specific query matched
    leave = await Leave.findOne({ employeeId: userId }).sort({ createdAt: -1 }).lean();
  }

  if (!leave) {
    return { success: false, message: "No matching leave request found." };
  }

  return {
    success: true,
    leave: {
      leaveId: leave._id,
      leaveType: leave.leaveType,
      startDate: leave.startDate,
      endDate: leave.endDate,
      totalDays: leave.totalDays,
      status: leave.status,
      reason: leave.reason,
      reviewNotes: leave.reviewNotes || "",
      reviewedAt: leave.reviewedAt || null,
      isHalfDay: Boolean(leave.isHalfDay),
    },
  };
};

registerAiTool({
  name: "get_my_leave_balance",
  domain: "LEAVE",
  capability: "LEAVE:GET_BALANCE",
  definition: READ_ONLY_AI_TOOLS.find((t) => t.function.name === "get_my_leave_balance"),
  execute: executeGetMyLeaveBalance,
});

registerAiTool({
  name: "get_my_leave_requests",
  domain: "LEAVE",
  capability: "LEAVE:GET_MY_REQUESTS",
  definition: READ_ONLY_AI_TOOLS.find((t) => t.function.name === "get_my_leave_requests"),
  execute: executeGetMyLeaveRequests,
});

registerAiTool({
  name: "get_my_leave_request_details",
  domain: "LEAVE",
  capability: "LEAVE:GET_REQUEST_DETAILS",
  definition: READ_ONLY_AI_TOOLS.find((t) => t.function.name === "get_my_leave_request_details"),
  execute: executeGetMyLeaveRequestDetails,
});

/**
 * Authoritative Allowlist of Safe Employee Destinations.
 * Verified against frontend React Router configuration in frontend/src/App.tsx.
 * The LLM outputs a logical destination key; never an arbitrary route or URL.
 */
export const EMPLOYEE_NAVIGATION_DESTINATIONS = Object.freeze({
  "dashboard": {
    path: "/dashboard",
    label: "Dashboard",
    description: "Main employee overview and booking summaries",
  },
  "book-room": {
    path: "/book-room",
    label: "Book Room",
    description: "Meeting room reservation and search interface",
  },
  "my-bookings": {
    path: "/manage-bookings",
    label: "My Bookings",
    description: "Active and upcoming meeting room reservations",
  },
  "booking-history": {
    path: "/booking-history",
    label: "Booking History",
    description: "Past meeting room reservations log",
  },
  "attendance": {
    path: "/attendance",
    label: "My Attendance",
    description: "Daily attendance punch-in, punch-out, and attendance history",
  },
  "leaves": {
    path: "/leaves",
    label: "My Leaves",
    description: "Personal leave balances, history, and leave applications",
  },
  "notifications": {
    path: "/notifications",
    label: "Notifications",
    description: "Inbox of employee system notifications and alerts",
  },
  "profile": {
    path: "/profile",
    label: "Profile",
    description: "Personal employee profile information",
  },
});

export const executeGetMyNotifications = async (args, context) => {
  const userId = context?.userId || context?.user?._id;
  if (!userId) {
    return { error: "UNAUTHORIZED", message: "Authenticated user identity required." };
  }

  return getUserNotifications({
    userId,
    limit: args?.limit,
    isRead: args?.isRead,
  });
};

export const executeGetMyUnreadNotifications = async (args, context) => {
  const userId = context?.userId || context?.user?._id;
  if (!userId) {
    return { error: "UNAUTHORIZED", message: "Authenticated user identity required." };
  }

  return getUserUnreadNotifications({ userId });
};

export const executeGetMyNotificationDetails = async (args, context) => {
  const userId = context?.userId || context?.user?._id;
  if (!userId) {
    return { error: "UNAUTHORIZED", message: "Authenticated user identity required." };
  }

  return getUserNotificationDetails({
    userId,
    notificationId: args?.notificationId,
    query: args?.query,
  });
};

export const executeGetMyProfile = async (args, context) => {
  const userId = context?.userId || context?.user?._id;
  if (!userId) {
    return { error: "UNAUTHORIZED", message: "Authenticated user identity required." };
  }

  return getUserProfileService({ userId });
};

registerAiTool({
  name: "get_my_notifications",
  domain: "NOTIFICATION",
  capability: "NOTIFICATION:GET_MY_NOTIFICATIONS",
  definition: READ_ONLY_AI_TOOLS.find((t) => t.function.name === "get_my_notifications"),
  execute: executeGetMyNotifications,
});

registerAiTool({
  name: "get_my_unread_notifications",
  domain: "NOTIFICATION",
  capability: "NOTIFICATION:GET_UNREAD",
  definition: READ_ONLY_AI_TOOLS.find((t) => t.function.name === "get_my_unread_notifications"),
  execute: executeGetMyUnreadNotifications,
});

registerAiTool({
  name: "get_my_notification_details",
  domain: "NOTIFICATION",
  capability: "NOTIFICATION:GET_NOTIFICATION_DETAILS",
  definition: READ_ONLY_AI_TOOLS.find((t) => t.function.name === "get_my_notification_details"),
  execute: executeGetMyNotificationDetails,
});

registerAiTool({
  name: "get_my_profile",
  domain: "PROFILE",
  capability: "PROFILE:GET_MY_PROFILE",
  definition: READ_ONLY_AI_TOOLS.find((t) => t.function.name === "get_my_profile"),
  execute: executeGetMyProfile,
});

/**
 * Phase 12: Allowlisted Manager Application Navigation Destinations
 */
export const MANAGER_NAVIGATION_DESTINATIONS = Object.freeze({
  "manager-dashboard": {
    path: "/manager",
    label: "Manager Dashboard",
    description: "Manager overview and administrative controls",
  },
  "all-bookings": {
    path: "/manager/all-bookings",
    label: "All Bookings",
    description: "Enterprise meeting room bookings across all employees",
  },
  "room-availability": {
    path: "/manager/room-availability",
    label: "Room Availability",
    description: "Enterprise room occupancy and live schedule",
  },
  "manage-rooms": {
    path: "/manager/manage-rooms",
    label: "Manage Rooms",
    description: "Meeting room inventory and settings",
  },
  "manager-attendance": {
    path: "/manager/attendance",
    label: "Manager Attendance",
    description: "Organization live attendance board",
  },
  "manager-leaves": {
    path: "/manager/leaves",
    label: "Manager Leaves",
    description: "Employee leave approvals and management",
  },
  "manager-leave-balances": {
    path: "/manager/leaves/balances",
    label: "Manager Leave Balances",
    description: "Employee leave quota and balance overview",
  },
  "manager-notifications": {
    path: "/manager/notifications",
    label: "Manager Notifications",
    description: "Manager alerts and system notifications",
  },
  "manager-profile": {
    path: "/manager/profile",
    label: "Manager Profile",
    description: "Manager profile and account settings",
  },
});

/**
 * Phase 12: Executes search_manager_bookings for authorized managers.
 */
export const executeSearchManagerBookings = async (args, context) => {
  const userRole = context?.user?.role || "employee";
  if (userRole !== "manager") {
    return { error: "FORBIDDEN", message: "Only managers are authorized to search enterprise bookings." };
  }

  const timeZone = resolveBranchTimezone(context?.user?.branch) || "Asia/Kolkata";
  let resolvedDate = undefined;
  if (args?.date) {
    const dRes = resolveDate(args.date, timeZone);
    if (dRes.resolvedDate) resolvedDate = dRes.resolvedDate;
  }

  let resolvedStartDate = undefined;
  if (args?.startDate) {
    const sRes = resolveDate(args.startDate, timeZone);
    if (sRes.resolvedDate) resolvedStartDate = sRes.resolvedDate;
  }

  let resolvedEndDate = undefined;
  if (args?.endDate) {
    const eRes = resolveDate(args.endDate, timeZone);
    if (eRes.resolvedDate) resolvedEndDate = eRes.resolvedDate;
  }

  return await searchManagerBookings({
    date: resolvedDate,
    startDate: resolvedStartDate,
    endDate: resolvedEndDate,
    branch: args?.branch,
    roomNumber: args?.roomNumber,
    employeeName: args?.employeeName,
    status: args?.status,
    startTime: args?.startTime,
    limit: args?.limit,
  });
};

/**
 * Phase 12: Executes get_manager_booking_details for authorized managers.
 */
export const executeGetManagerBookingDetails = async (args, context) => {
  const userRole = context?.user?.role || "employee";
  if (userRole !== "manager") {
    return { error: "FORBIDDEN", message: "Only managers are authorized to view arbitrary enterprise booking details." };
  }

  if (!args?.bookingId) {
    return { error: "INVALID_REQUEST", message: "bookingId is required" };
  }

  const booking = await getManagerBookingDetails({ bookingId: args.bookingId });
  if (!booking) {
    return { error: "NOT_FOUND", message: `Booking with ID '${args.bookingId}' was not found.` };
  }

  return { success: true, booking };
};

/**
 * Phase 12: Executes get_manager_room_availability for authorized managers.
 */
export const executeGetManagerRoomAvailability = async (args, context) => {
  const userRole = context?.user?.role || "employee";
  if (userRole !== "manager") {
    return { error: "FORBIDDEN", message: "Only managers are authorized to check enterprise room availability." };
  }

  const timeZone = resolveBranchTimezone(args?.branch || context?.user?.branch) || "Asia/Kolkata";
  const dateRes = resolveDate(args?.date, timeZone);
  if (!dateRes.resolvedDate) {
    return { error: "INVALID_DATE", message: dateRes.error || "Valid date required." };
  }

  const timeRes = resolveTime(args?.startTime);
  if (!timeRes.resolvedStartTime) {
    return { error: "INVALID_TIME", message: timeRes.error || "Valid startTime required." };
  }

  const result = await getRoomAvailabilityService({
    date: dateRes.resolvedDate,
    startTime: timeRes.resolvedStartTime,
    filters: {
      branch: args?.branch,
      roomType: args?.roomType,
    },
  });

  return {
    success: true,
    date: dateRes.resolvedDate,
    startTime: timeRes.resolvedStartTime,
    ...result,
  };
};

/**
 * Phase 12: Executes get_manager_room_utilization for authorized managers.
 */
export const executeGetManagerRoomUtilization = async (args, context) => {
  const userRole = context?.user?.role || "employee";
  if (userRole !== "manager") {
    return { error: "FORBIDDEN", message: "Only managers are authorized to view room utilization." };
  }

  const timeZone = resolveBranchTimezone(args?.branch || context?.user?.branch) || "Asia/Kolkata";
  const startRes = resolveDate(args?.startDate, timeZone);
  const endRes = resolveDate(args?.endDate, timeZone);

  if (!startRes.resolvedDate || !endRes.resolvedDate) {
    return { error: "INVALID_DATE_RANGE", message: "Valid startDate and endDate are required." };
  }

  const result = await getRoomUtilizationService({
    roomNumber: args?.roomNumber,
    branch: args?.branch,
    startDate: startRes.resolvedDate,
    endDate: endRes.resolvedDate,
  });

  return {
    success: true,
    ...result,
  };
};

registerAiTool({
  name: "search_manager_bookings",
  domain: "BOOKING",
  capability: "BOOKING:SEARCH_MANAGER",
  definition: READ_ONLY_AI_TOOLS.find((t) => t.function.name === "search_manager_bookings"),
  execute: executeSearchManagerBookings,
});

registerAiTool({
  name: "get_manager_booking_details",
  domain: "BOOKING",
  capability: "BOOKING:GET_DETAILS_MGR",
  definition: READ_ONLY_AI_TOOLS.find((t) => t.function.name === "get_manager_booking_details"),
  execute: executeGetManagerBookingDetails,
});

registerAiTool({
  name: "get_manager_room_availability",
  domain: "ROOM",
  capability: "ROOM:GET_AVAILABILITY_MGR",
  definition: READ_ONLY_AI_TOOLS.find((t) => t.function.name === "get_manager_room_availability"),
  execute: executeGetManagerRoomAvailability,
});

registerAiTool({
  name: "get_manager_room_utilization",
  domain: "ROOM",
  capability: "ROOM:GET_UTILIZATION_MGR",
  definition: READ_ONLY_AI_TOOLS.find((t) => t.function.name === "get_manager_room_utilization"),
  execute: executeGetManagerRoomUtilization,
});

/**
 * Phase 13: Executes search_manager_attendance for authorized managers.
 */
export const executeSearchManagerAttendance = async (args, context) => {
  const userRole = context?.user?.role || "employee";
  if (userRole !== "manager") {
    return { error: "FORBIDDEN", message: "Only managers are authorized to search team attendance." };
  }

  const timeZone = resolveBranchTimezone(args?.branch || context?.user?.branch) || "Asia/Kolkata";
  let resolvedDate = undefined;
  if (args?.date) {
    const d = resolveDate(args.date, timeZone);
    if (d.resolvedDate) resolvedDate = d.resolvedDate;
  }

  let resolvedStart = undefined;
  let resolvedEnd = undefined;
  if (args?.startDate) {
    const s = resolveDate(args.startDate, timeZone);
    if (s.resolvedDate) resolvedStart = s.resolvedDate;
  }
  if (args?.endDate) {
    const e = resolveDate(args.endDate, timeZone);
    if (e.resolvedDate) resolvedEnd = e.resolvedDate;
  }

  const result = await searchManagerAttendance({
    date: resolvedDate,
    startDate: resolvedStart,
    endDate: resolvedEnd,
    month: args?.month,
    year: args?.year,
    employeeName: args?.employeeName,
    status: args?.status,
    branch: args?.branch,
    limit: args?.limit,
  });

  return {
    success: true,
    ...result,
  };
};

/**
 * Phase 13: Executes get_manager_attendance_details for authorized managers.
 */
export const executeGetManagerAttendanceDetails = async (args, context) => {
  const userRole = context?.user?.role || "employee";
  if (userRole !== "manager") {
    return { error: "FORBIDDEN", message: "Only managers are authorized to view detailed employee attendance." };
  }

  if (!args?.employeeName) {
    return { error: "INVALID_REQUEST", message: "employeeName is required." };
  }

  const timeZone = resolveBranchTimezone(context?.user?.branch) || "Asia/Kolkata";
  let resolvedDate = undefined;
  if (args?.date) {
    const d = resolveDate(args.date, timeZone);
    if (d.resolvedDate) resolvedDate = d.resolvedDate;
  }

  const result = await getManagerAttendanceDetails({
    employeeName: args.employeeName,
    date: resolvedDate,
  });

  return {
    success: true,
    ...result,
  };
};

/**
 * Phase 13: Executes get_manager_daily_attendance_summary for authorized managers.
 */
export const executeGetManagerDailyAttendanceSummary = async (args, context) => {
  const userRole = context?.user?.role || "employee";
  if (userRole !== "manager") {
    return { error: "FORBIDDEN", message: "Only managers are authorized to view daily attendance summary." };
  }

  const timeZone = resolveBranchTimezone(args?.branch || context?.user?.branch) || "Asia/Kolkata";
  let resolvedDate = undefined;
  if (args?.date) {
    const d = resolveDate(args.date, timeZone);
    if (d.resolvedDate) resolvedDate = d.resolvedDate;
  }

  const result = await getManagerDailyAttendanceSummary({
    date: resolvedDate,
    branch: args?.branch,
  });

  return {
    success: true,
    ...result,
  };
};

/**
 * Phase 13: Executes get_manager_monthly_attendance_summary for authorized managers.
 */
export const executeGetManagerMonthlyAttendanceSummary = async (args, context) => {
  const userRole = context?.user?.role || "employee";
  if (userRole !== "manager") {
    return { error: "FORBIDDEN", message: "Only managers are authorized to view monthly attendance summary." };
  }

  const result = await getManagerMonthlyAttendanceSummary({
    month: args?.month,
    year: args?.year,
    branch: args?.branch,
    employeeName: args?.employeeName,
  });

  return {
    success: true,
    ...result,
  };
};

/**
 * Phase 13: Executes get_manager_not_checked_in for authorized managers.
 */
export const executeGetManagerNotCheckedIn = async (args, context) => {
  const userRole = context?.user?.role || "employee";
  if (userRole !== "manager") {
    return { error: "FORBIDDEN", message: "Only managers are authorized to view unchecked-in employees." };
  }

  const timeZone = resolveBranchTimezone(args?.branch || context?.user?.branch) || "Asia/Kolkata";
  let resolvedDate = undefined;
  if (args?.date) {
    const d = resolveDate(args.date, timeZone);
    if (d.resolvedDate) resolvedDate = d.resolvedDate;
  }

  const result = await getManagerNotCheckedIn({
    date: resolvedDate,
    branch: args?.branch,
  });

  return {
    success: true,
    ...result,
  };
};

registerAiTool({
  name: "search_manager_attendance",
  domain: "ATTENDANCE",
  capability: "ATTENDANCE:SEARCH_MANAGER",
  definition: READ_ONLY_AI_TOOLS.find((t) => t.function.name === "search_manager_attendance"),
  execute: executeSearchManagerAttendance,
});

registerAiTool({
  name: "get_manager_attendance_details",
  domain: "ATTENDANCE",
  capability: "ATTENDANCE:GET_EMPLOYEE_DETAILS_MANAGER",
  definition: READ_ONLY_AI_TOOLS.find((t) => t.function.name === "get_manager_attendance_details"),
  execute: executeGetManagerAttendanceDetails,
});

registerAiTool({
  name: "get_manager_daily_attendance_summary",
  domain: "ATTENDANCE",
  capability: "ATTENDANCE:GET_DAILY_SUMMARY_MANAGER",
  definition: READ_ONLY_AI_TOOLS.find((t) => t.function.name === "get_manager_daily_attendance_summary"),
  execute: executeGetManagerDailyAttendanceSummary,
});

registerAiTool({
  name: "get_manager_monthly_attendance_summary",
  domain: "ATTENDANCE",
  capability: "ATTENDANCE:GET_MONTHLY_SUMMARY_MANAGER",
  definition: READ_ONLY_AI_TOOLS.find((t) => t.function.name === "get_manager_monthly_attendance_summary"),
  execute: executeGetManagerMonthlyAttendanceSummary,
});

registerAiTool({
  name: "get_manager_not_checked_in",
  domain: "ATTENDANCE",
  capability: "ATTENDANCE:GET_NOT_CHECKED_IN_MANAGER",
  definition: READ_ONLY_AI_TOOLS.find((t) => t.function.name === "get_manager_not_checked_in"),
  execute: executeGetManagerNotCheckedIn,
});

/**
 * Phase 14: Executes search_manager_leave_requests for authorized managers.
 */
export const executeSearchManagerLeaves = async (args, context) => {
  const userRole = context?.user?.role || "employee";
  if (userRole !== "manager") {
    return { error: "FORBIDDEN", message: "Only managers are authorized to search enterprise leave requests." };
  }

  const timeZone = resolveBranchTimezone(context?.user?.branch) || "Asia/Kolkata";
  let resolvedDate = undefined;
  if (args.date) {
    resolvedDate = resolveDate(args.date, timeZone).resolvedDate;
  }
  let resolvedStartDate = undefined;
  if (args.startDate) {
    resolvedStartDate = resolveDate(args.startDate, timeZone).resolvedDate;
  }
  let resolvedEndDate = undefined;
  if (args.endDate) {
    resolvedEndDate = resolveDate(args.endDate, timeZone).resolvedDate;
  }

  const result = await searchManagerLeaves({
    employeeName: args.employeeName,
    leaveType: args.leaveType,
    status: args.status,
    startDate: resolvedStartDate,
    endDate: resolvedEndDate,
    date: resolvedDate,
    startsOnDate: args.startsOnDate,
    month: args.month,
    year: args.year,
    branch: args.branch,
    limit: args.limit,
  });

  return {
    success: true,
    ...result,
  };
};

/**
 * Phase 14: Executes get_manager_leave_request_details for authorized managers.
 */
export const executeGetManagerLeaveDetails = async (args, context) => {
  const userRole = context?.user?.role || "employee";
  if (userRole !== "manager") {
    return { error: "FORBIDDEN", message: "Only managers are authorized to inspect leave request details." };
  }

  const result = await getManagerLeaveDetails({
    leaveId: args.leaveId,
    employeeName: args.employeeName,
    leaveType: args.leaveType,
    date: args.date,
  });

  return {
    success: true,
    ...result,
  };
};

/**
 * Phase 14: Executes get_manager_leave_balances for authorized managers.
 */
export const executeGetManagerLeaveBalances = async (args, context) => {
  const userRole = context?.user?.role || "employee";
  if (userRole !== "manager") {
    return { error: "FORBIDDEN", message: "Only managers are authorized to inspect leave balances." };
  }

  const result = await getManagerLeaveBalances({
    employeeName: args.employeeName,
    branch: args.branch,
    year: args.year,
  });

  return {
    success: true,
    ...result,
  };
};

/**
 * Phase 14: Executes get_manager_active_leaves_today for authorized managers.
 */
export const executeGetManagerActiveLeavesToday = async (args, context) => {
  const userRole = context?.user?.role || "employee";
  if (userRole !== "manager") {
    return { error: "FORBIDDEN", message: "Only managers are authorized to check employees on leave." };
  }

  const timeZone = resolveBranchTimezone(context?.user?.branch) || "Asia/Kolkata";
  let resolvedDate = undefined;
  if (args.date) {
    resolvedDate = resolveDate(args.date, timeZone).resolvedDate;
  }

  const result = await getManagerActiveLeavesOnDate({
    date: resolvedDate,
    branch: args.branch,
  });

  return {
    success: true,
    ...result,
  };
};

// ── Phase 14 Tool Registrations ──────────────────────────────────────────────

registerAiTool({
  name: "search_manager_leave_requests",
  domain: "LEAVE",
  capability: "LEAVE:SEARCH_MANAGER",
  definition: READ_ONLY_AI_TOOLS.find((t) => t.function.name === "search_manager_leave_requests"),
  execute: executeSearchManagerLeaves,
});

registerAiTool({
  name: "get_manager_leave_request_details",
  domain: "LEAVE",
  capability: "LEAVE:GET_REQUEST_DETAILS_MGR",
  definition: READ_ONLY_AI_TOOLS.find((t) => t.function.name === "get_manager_leave_request_details"),
  execute: executeGetManagerLeaveDetails,
});

registerAiTool({
  name: "get_manager_leave_balances",
  domain: "LEAVE",
  capability: "LEAVE:GET_BALANCES_MGR",
  definition: READ_ONLY_AI_TOOLS.find((t) => t.function.name === "get_manager_leave_balances"),
  execute: executeGetManagerLeaveBalances,
});

registerAiTool({
  name: "get_manager_active_leaves_today",
  domain: "LEAVE",
  capability: "LEAVE:GET_ACTIVE_TODAY",
  definition: READ_ONLY_AI_TOOLS.find((t) => t.function.name === "get_manager_active_leaves_today"),
  execute: executeGetManagerActiveLeavesToday,
});


/**
 * Dispatcher for executing allowed read-only AI tools.
 * Validates tool allowlist and server-side capability authorization.
 *
 * @param {string} toolName
 * @param {Object} toolArgs
 * @param {Object} context - Verified server context: { user: { _id, branch, country, role } }
 * @returns {Promise<Object>}
 */
export const executeAiTool = async (toolName, toolArgs, context) => {
  const toolEntry = TOOL_REGISTRY.get(toolName);
  if (!toolEntry) {
    return {
      error: "FORBIDDEN_TOOL",
      message: `Tool '${toolName}' is not permitted. Only read-only query tools are available.`,
    };
  }

  // Server-authoritative capability check
  const userRole = context?.user?.role || "employee";
  if (toolEntry.capability && !isCapabilityAuthorized(toolEntry.capability, userRole)) {
    return {
      error: "FORBIDDEN_TOOL",
      message: `Role '${userRole}' is not authorized to execute tool '${toolName}'.`,
    };
  }

  return await toolEntry.execute(toolArgs, context);
};
