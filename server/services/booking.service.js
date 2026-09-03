import { Booking } from "../models/booking.model.js";
import { Room } from "../models/room.model.js";
import { User } from "../models/user.model.js";
import mongoose from "mongoose";
import { signMeetingLinkToken, verifyMeetingLinkToken } from "../config/jwt.js";
import { addThirtyMinutes, isValidHalfHourSlot } from "../utils/generateSlots.js";
import { createBulkNotifications, createNotification } from "./notification.service.js";
import { sendOwnerMeetingEmail, sendParticipantRoomDetailsEmail } from "./email.service.js";
import { getZonedDateTimeParts } from "../utils/dateTimeResolver.js";
import { DEFAULT_TIMEZONE } from "../config/timezones.js";

const toDateTime = (date, time) => new Date(`${date}T${time}:00`);
const getCheckInCutoff = (date, startTime) => {
  const start = toDateTime(date, startTime);
  return new Date(start.getTime() + 10 * 60 * 1000);
};

const getBackendBase = () =>
  process.env.BACKEND_URL || process.env.SERVER_URL || `http://localhost:${process.env.PORT || 5000}`;

const buildRoomLabel = (room) => `${room.branch}-${room.block}-${room.roomNumber}`;
const buildRoomLocation = (room) => `${room.country}, ${room.branch}, ${room.block}, ${room.floor}`;

export const createBooking = async ({ ownerId, roomId, date, startTime, invitedMembers = [], title = "" }) => {
  if (!isValidHalfHourSlot(startTime)) {
    const err = new Error("startTime must match HH:mm and be in 30-minute slots");
    err.statusCode = 400;
    throw err;
  }

  const normalizedInvites = invitedMembers
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  const inviteObjectIds = normalizedInvites.filter((value) => mongoose.Types.ObjectId.isValid(value));
  const inviteEmails = normalizedInvites
    .filter((value) => value.includes("@"))
    .map((value) => value.toLowerCase());
  const inviteClauses = [
    ...(inviteObjectIds.length ? [{ _id: { $in: inviteObjectIds } }] : []),
    ...(inviteEmails.length ? [{ email: { $in: inviteEmails } }] : []),
  ];
  const invitedUsersLookup = inviteClauses.length ? await User.find({ $or: inviteClauses }).lean() : [];
  const resolvedInvitedMemberIds = [...new Set(invitedUsersLookup.map((user) => String(user._id)))];
  const resolvedEmails = invitedUsersLookup
    .map((user) => user.email)
    .filter(Boolean)
    .map((email) => String(email).toLowerCase());
  const extraInviteEmails = inviteEmails.filter((email) => !resolvedEmails.includes(email));

  const endTime = addThirtyMinutes(startTime);
  const booking = await Booking.create({
    ownerId,
    roomId,
    date,
    startTime,
    endTime,
    invitedMembers: resolvedInvitedMemberIds,
    title: String(title || "").trim(),
    status: "booked",
  });
  const [room, owner, invitedUsers] = await Promise.all([
    Room.findById(roomId).lean(),
    User.findById(ownerId).lean(),
    resolvedInvitedMemberIds.length ? User.find({ _id: { $in: resolvedInvitedMemberIds } }).lean() : Promise.resolve([]),
  ]);

  if (owner?.email && room) {
    const meetingToken = signMeetingLinkToken({
      bookingId: String(booking._id),
      ownerId: String(ownerId),
    });
    const clientBase = process.env.CLIENT_URL || "http://localhost:5173";
    const meetingLink = `${clientBase.replace(/\/$/, "")}/meeting-check-in?token=${encodeURIComponent(meetingToken)}`;
    await sendOwnerMeetingEmail({
      to: owner.email,
      ownerName: owner.name,
      ownerEmail: owner.email,
      ownerEmployeeId: owner.employeeId,
      roomName: buildRoomLabel(room),
      location: buildRoomLocation(room),
      date,
      startTime,
      endTime,
      participants: invitedUsers.map((u) => `${u.name} (${u.email})`),
      meetingLink,
    });
  }

  const participantEmailTargets = [
    ...invitedUsers.map((user) => user.email).filter(Boolean),
    ...extraInviteEmails
  ];
  const uniqueParticipantEmails = [...new Set(participantEmailTargets.map((email) => String(email).toLowerCase()))];

  if (room && uniqueParticipantEmails.length) {
    await Promise.all(
      uniqueParticipantEmails.map((email) =>
        sendParticipantRoomDetailsEmail({
          to: email,
          organizerName: owner?.name || "Organizer",
          organizerEmail: owner?.email || "-",
          roomName: buildRoomLabel(room),
          location: buildRoomLocation(room),
          date,
          startTime,
          endTime,
        }),
      ),
    );
  }

  if (resolvedInvitedMemberIds.length) {
    await createBulkNotifications(
      resolvedInvitedMemberIds.map((userId) => ({
        userId,
        title: "Meeting Invite",
        message: `${owner?.name || "A colleague"} invited you to a meeting on ${date} at ${startTime}`,
        type: "invite",
        metadata: { bookingId: booking._id, roomId }
      }))
    );
  }

  await createNotification({
    userId: ownerId,
    title: "Booking Created",
    message: `Your room booking is confirmed for ${date} ${startTime}-${endTime}`,
    type: "system",
    metadata: { bookingId: booking._id, roomId }
  });

  return booking;
};

export const cancelBooking = async (bookingId, userId) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    const err = new Error("Booking not found");
    err.statusCode = 404;
    throw err;
  }
  if (String(booking.ownerId) !== String(userId)) {
    const err = new Error("Only booking owner can cancel");
    err.statusCode = 403;
    throw err;
  }
  if (booking.status === "cancelled") {
    const err = new Error("Booking is already cancelled");
    err.statusCode = 400;
    throw err;
  }
  booking.status = "cancelled";
  booking.canceledAt = new Date();
  await booking.save();
  return booking;
};

export const getCheckInDetailsByToken = async (token) => {
  const decoded = verifyMeetingLinkToken(token);
  const booking = await Booking.findById(decoded.bookingId)
    .populate("roomId")
    .populate("ownerId", "name email employeeId")
    .populate("invitedMembers", "name email")
    .lean();

  if (!booking) {
    const err = new Error("Booking not found");
    err.statusCode = 404;
    throw err;
  }

  const room = booking.roomId;
  const owner = booking.ownerId;
  const now = new Date();
  const startAt = toDateTime(booking.date, booking.startTime);
  const cutoffAt = getCheckInCutoff(booking.date, booking.startTime);
  const canCheckIn = booking.status === "booked" && !booking.occupancyConfirmedAt && now >= startAt && now <= cutoffAt;

  return {
    bookingId: String(booking._id),
    status: booking.status,
    date: booking.date,
    startTime: booking.startTime,
    endTime: booking.endTime,
    occupancyConfirmedAt: booking.occupancyConfirmedAt,
    cutoffAt: cutoffAt.toISOString(),
    canCheckIn,
    owner: owner
      ? { name: owner.name, email: owner.email, employeeId: owner.employeeId }
      : null,
    room: room
      ? {
          roomNumber: room.roomNumber,
          roomType: room.roomType,
          capacity: room.capacity,
          country: room.country,
          branch: room.branch,
          block: room.block,
          floor: room.floor,
        }
      : null,
    participants: (booking.invitedMembers || []).map((p) => ({ name: p.name, email: p.email })),
  };
};

export const confirmOccupancyByToken = async (token) => {
  const decoded = verifyMeetingLinkToken(token);
  const booking = await Booking.findById(decoded.bookingId);
  if (!booking) {
    const err = new Error("Booking not found");
    err.statusCode = 404;
    throw err;
  }

  if (String(booking.ownerId) !== String(decoded.ownerId)) {
    const err = new Error("Invalid check-in link");
    err.statusCode = 403;
    throw err;
  }

  if (booking.status !== "booked") {
    const err = new Error("Booking is not active");
    err.statusCode = 400;
    throw err;
  }

  if (booking.occupancyConfirmedAt) {
    return booking;
  }

  const now = new Date();
  const startAt = toDateTime(booking.date, booking.startTime);
  const cutoffAt = getCheckInCutoff(booking.date, booking.startTime);

  if (now < startAt) {
    const err = new Error("Check-in opens at meeting start time");
    err.statusCode = 400;
    throw err;
  }

  if (now > cutoffAt) {
    booking.status = "cancelled";
    booking.canceledAt = now;
    await booking.save();
    await Room.updateOne({ _id: booking.roomId }, { $set: { isOccupied: false } });
    const err = new Error("Check-in window has expired. Booking cancelled.");
    err.statusCode = 400;
    throw err;
  }

  booking.occupancyConfirmedAt = now;
  await booking.save();
  await Room.updateOne({ _id: booking.roomId }, { $set: { isOccupied: true } });
  return booking;
};

export const cancelNoShowBookings = async () => {
  const now = new Date();
  const activeBookings = await Booking.find({ status: "booked", occupancyConfirmedAt: null })
    .select("_id roomId date startTime")
    .lean();

  const toCancelIds = activeBookings
    .filter((booking) => now > getCheckInCutoff(booking.date, booking.startTime))
    .map((booking) => booking._id);
  const toCancelRoomIds = activeBookings
    .filter((booking) => now > getCheckInCutoff(booking.date, booking.startTime))
    .map((booking) => booking.roomId);

  if (!toCancelIds.length) return 0;

  const result = await Booking.updateMany(
    { _id: { $in: toCancelIds }, status: "booked", occupancyConfirmedAt: null },
    { $set: { status: "cancelled", canceledAt: now } },
  );

  if (toCancelRoomIds.length) {
    await Room.updateMany({ _id: { $in: toCancelRoomIds } }, { $set: { isOccupied: false } });
  }

  return result.modifiedCount || 0;
};

export const clearEndedMeetingsOccupancy = async () => {
  const now = new Date();
  const activeBookings = await Booking.find({
    status: "booked",
    occupancyConfirmedAt: { $ne: null }
  })
    .select("_id roomId date endTime")
    .lean();

  const endedBookings = activeBookings.filter((booking) => now > toDateTime(booking.date, booking.endTime));

  if (!endedBookings.length) return 0;

  const endedBookingIds = endedBookings.map((b) => b._id);
  const endedRoomIds = endedBookings.map((b) => b.roomId);

  await Room.updateMany({ _id: { $in: endedRoomIds } }, { $set: { isOccupied: false } });

  const result = await Booking.updateMany(
    { _id: { $in: endedBookingIds } },
    { $set: { status: "completed" } },
  );

  return result.modifiedCount || 0;
};

/**
 * Phase 11: Retrieves the next strictly-future active booking for the user.
 * "Next meeting = earliest owned booking whose start time is strictly after the current time."
 * In-progress or past meetings are strictly excluded.
 *
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.userId
 * @param {Date} [params.referenceDate=new Date()]
 * @param {string} [params.timeZone=DEFAULT_TIMEZONE]
 * @returns {Promise<Object|null>}
 */
export const getMyNextBooking = async ({ userId, referenceDate = new Date(), timeZone = DEFAULT_TIMEZONE }) => {
  if (!userId) return null;
  const p = getZonedDateTimeParts(referenceDate, timeZone);
  const pad = (n) => String(n).padStart(2, "0");
  const todayStr = `${p.year}-${pad(p.month)}-${pad(p.day)}`;
  const currentTimeStr = `${pad(p.hour)}:${pad(p.minute)}`;

  const filter = {
    ownerId: userId,
    status: "booked",
    $or: [
      { date: { $gt: todayStr } },
      { date: todayStr, startTime: { $gt: currentTimeStr } },
    ],
  };

  const booking = await Booking.findOne(filter)
    .populate("roomId")
    .sort({ date: 1, startTime: 1 })
    .lean();

  return booking;
};

/**
 * Phase 11: Retrieves upcoming bookings for the authenticated user.
 * Optionally filtered to a specific date (e.g., today or tomorrow).
 *
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.userId
 * @param {string} [params.date] - Optional target date (YYYY-MM-DD)
 * @param {string} [params.timeZone=DEFAULT_TIMEZONE]
 * @param {number} [params.limit=10]
 * @returns {Promise<Array<Object>>}
 */
export const getMyUpcomingBookings = async ({ userId, date, timeZone = DEFAULT_TIMEZONE, limit = 10 }) => {
  if (!userId) return [];
  const queryLimit = Math.min(Math.max(1, Number(limit) || 10), 20);

  const filter = {
    ownerId: userId,
    status: "booked",
  };

  if (date) {
    filter.date = date;
  } else {
    const p = getZonedDateTimeParts(new Date(), timeZone);
    const pad = (n) => String(n).padStart(2, "0");
    filter.date = { $gte: `${p.year}-${pad(p.month)}-${pad(p.day)}` };
  }

  const bookings = await Booking.find(filter)
    .populate("roomId")
    .sort({ date: 1, startTime: 1 })
    .limit(queryLimit)
    .lean();

  return bookings;
};

/**
 * Phase 11: Finds owned bookings matching date and optional startTime.
 * Enables ambiguity resolution when user asks "Tell me about my 3 PM meeting".
 *
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.userId
 * @param {string} [params.date]
 * @param {string} [params.startTime]
 * @returns {Promise<Array<Object>>}
 */
export const findMyBookingsByDateTime = async ({ userId, date, startTime }) => {
  if (!userId) return [];
  const filter = { ownerId: userId };
  if (date) filter.date = date;
  if (startTime) filter.startTime = startTime;

  const bookings = await Booking.find(filter)
    .populate("roomId")
    .sort({ date: 1, startTime: 1 })
    .lean();

  return bookings;
};

/**
 * Phase 11: Authoritative ownership-scoped booking details retrieval.
 * Returns full populated booking, separating reservation lifecycle status from occupancy status.
 *
 * @param {Object} params
 * @param {string} params.bookingId
 * @param {string|mongoose.Types.ObjectId} params.userId
 * @returns {Promise<Object>}
 */
export const getMyBookingDetails = async ({ bookingId, userId }) => {
  if (!bookingId) {
    const err = new Error("bookingId is required");
    err.statusCode = 400;
    throw err;
  }

  const booking = await Booking.findById(bookingId)
    .populate("roomId")
    .populate("ownerId", "name email employeeId")
    .populate("invitedMembers", "name email")
    .lean();

  if (!booking) {
    const err = new Error("Booking not found");
    err.statusCode = 404;
    throw err;
  }

  const bookingOwnerId = booking.ownerId?._id ? String(booking.ownerId._id) : String(booking.ownerId);
  if (bookingOwnerId !== String(userId)) {
    const err = new Error("Only the booking owner can view these details");
    err.statusCode = 403;
    throw err;
  }

  return booking;
};

/**
 * Phase 12: Manager-scope booking search across all employees and rooms.
 * Supports filtering by date, date range, branch, roomNumber, employeeName, status, startTime.
 * Handles 0, 1, or multiple employee name matches with explicit status.
 * Never exposes secretCode.
 *
 * @param {Object} params
 * @param {string} [params.date] - YYYY-MM-DD
 * @param {string} [params.startDate] - YYYY-MM-DD
 * @param {string} [params.endDate] - YYYY-MM-DD
 * @param {string} [params.branch]
 * @param {string} [params.roomNumber]
 * @param {string} [params.employeeName]
 * @param {string} [params.status] - "booked" | "cancelled" | "completed"
 * @param {string} [params.startTime] - HH:mm
 * @param {number} [params.limit=20]
 * @returns {Promise<{ count: number, bookings: Array<Object>, employeeMatchStatus: string, matchedEmployees?: Array<Object> }>}
 */
export const searchManagerBookings = async ({
  date,
  startDate,
  endDate,
  branch,
  roomNumber,
  employeeName,
  status,
  startTime,
  limit = 20,
}) => {
  const bookingFilter = {};
  let employeeMatchStatus = "NONE";
  let matchedEmployees = [];

  // Employee name resolution
  if (employeeName && typeof employeeName === "string" && employeeName.trim()) {
    const cleanName = employeeName.trim();
    matchedEmployees = await User.find({
      name: { $regex: new RegExp(cleanName, "i") },
    })
      .select("_id name email employeeId role")
      .lean();

    if (matchedEmployees.length === 0) {
      return {
        count: 0,
        bookings: [],
        employeeMatchStatus: "NOT_FOUND",
        matchedEmployees: [],
      };
    } else if (matchedEmployees.length > 1) {
      return {
        count: 0,
        bookings: [],
        employeeMatchStatus: "AMBIGUOUS",
        matchedEmployees,
      };
    } else {
      employeeMatchStatus = "MATCHED";
      bookingFilter.ownerId = matchedEmployees[0]._id;
    }
  }

  // Date filtering
  if (date) {
    bookingFilter.date = String(date).trim();
  } else if (startDate && endDate) {
    bookingFilter.date = { $gte: String(startDate).trim(), $lte: String(endDate).trim() };
  } else if (startDate) {
    bookingFilter.date = { $gte: String(startDate).trim() };
  } else if (endDate) {
    bookingFilter.date = { $lte: String(endDate).trim() };
  }

  // Time filtering
  if (startTime) {
    bookingFilter.startTime = String(startTime).trim();
  }

  // Status filtering
  if (status) {
    bookingFilter.status = String(status).trim().toLowerCase();
  }

  // Room / Branch filtering
  if (roomNumber || branch) {
    const roomCriteria = { isActive: true };
    if (roomNumber) roomCriteria.roomNumber = String(roomNumber).trim();
    if (branch) roomCriteria.branch = String(branch).trim();

    const matchingRooms = await Room.find(roomCriteria).select("_id").lean();
    if (!matchingRooms.length) {
      return {
        count: 0,
        bookings: [],
        employeeMatchStatus,
        matchedEmployees,
      };
    }
    bookingFilter.roomId = { $in: matchingRooms.map((r) => r._id) };
  }

  const queryLimit = Math.min(Math.max(1, Number(limit) || 20), 50);

  const rawBookings = await Booking.find(bookingFilter)
    .select("-secretCode")
    .populate({ path: "roomId", select: "-secretCode" })
    .populate("ownerId", "name email employeeId role department")
    .sort({ date: 1, startTime: 1 })
    .limit(queryLimit)
    .lean();

  const sanitized = rawBookings.map((b) => {
    const { secretCode, ...rest } = b;
    if (rest.roomId && rest.roomId.secretCode) {
      delete rest.roomId.secretCode;
    }
    return rest;
  });

  return {
    count: sanitized.length,
    bookings: sanitized,
    employeeMatchStatus,
    matchedEmployees,
  };
};

/**
 * Phase 12: Indirect candidate locator for manager booking details inquiries.
 * Searches enterprise bookings matching indirect criteria (date, time, roomNumber, employeeName, branch).
 * Enables 0/1/2+ candidate ambiguity handling without artificial ID ambiguity.
 *
 * @param {Object} params
 * @returns {Promise<Array<Object>>}
 */
export const findManagerBookingsByCriteria = async ({
  date,
  startTime,
  roomNumber,
  employeeName,
  branch,
}) => {
  const result = await searchManagerBookings({
    date,
    startTime,
    roomNumber,
    employeeName,
    branch,
    limit: 10,
  });
  return result.bookings;
};

/**
 * Phase 12: Retrieve comprehensive booking details by explicit bookingId from manager scope.
 * Directly locates single booking regardless of owner. Excludes secretCode.
 *
 * @param {Object} params
 * @param {string} params.bookingId
 * @returns {Promise<Object|null>}
 */
export const getManagerBookingDetails = async ({ bookingId }) => {
  if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
    return null;
  }

  const booking = await Booking.findById(bookingId)
    .select("-secretCode")
    .populate({ path: "roomId", select: "-secretCode" })
    .populate("ownerId", "name email employeeId role department")
    .populate("invitedMembers", "name email")
    .lean();

  if (!booking) return null;

  delete booking.secretCode;
  if (booking.roomId && booking.roomId.secretCode) {
    delete booking.roomId.secretCode;
  }

  return booking;
};


