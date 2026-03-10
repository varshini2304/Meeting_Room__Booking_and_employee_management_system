import { Booking } from "../models/booking.model.js";
import { Room } from "../models/room.model.js";
import { User } from "../models/user.model.js";
import mongoose from "mongoose";
import { signMeetingLinkToken, verifyMeetingLinkToken } from "../config/jwt.js";
import { addThirtyMinutes, isValidHalfHourSlot } from "../utils/generateSlots.js";
import { createBulkNotifications, createNotification } from "./notification.service.js";
import { sendOwnerMeetingEmail, sendParticipantRoomDetailsEmail } from "./email.service.js";

const toDateTime = (date, time) => new Date(`${date}T${time}:00`);
const getCheckInCutoff = (date, startTime) => {
  const start = toDateTime(date, startTime);
  return new Date(start.getTime() + 10 * 60 * 1000);
};
const getBackendBase = () =>
  process.env.BACKEND_URL || process.env.SERVER_URL || `http://localhost:${process.env.PORT || 5000}`;

const buildRoomLabel = (room) => `${room.branch}-${room.block}-${room.roomNumber}`;
const buildRoomLocation = (room) => `${room.country}, ${room.branch}, ${room.block}, ${room.floor}`;

export const createBooking = async ({ ownerId, roomId, date, startTime, invitedMembers = [] }) => {
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

  const endTime = addThirtyMinutes(startTime);
  const booking = await Booking.create({
    ownerId,
    roomId,
    date,
    startTime,
    endTime,
    invitedMembers: resolvedInvitedMemberIds,
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
    const backendBase = getBackendBase();
    const meetingLink = `${backendBase.replace(/\/$/, "")}/api/bookings/check-in/page?token=${encodeURIComponent(meetingToken)}`;
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

  if (room && invitedUsers.length) {
    await Promise.all(
      invitedUsers
        .filter((user) => Boolean(user.email))
        .map((user) =>
          sendParticipantRoomDetailsEmail({
            to: user.email,
            roomName: buildRoomLabel(room),
            location: buildRoomLocation(room),
            date,
            startTime,
            endTime,
            organizerName: owner?.name || "Organizer",
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

  const endedRoomIds = activeBookings
    .filter((booking) => now > toDateTime(booking.date, booking.endTime))
    .map((booking) => booking.roomId);

  if (!endedRoomIds.length) return 0;

  const result = await Room.updateMany({ _id: { $in: endedRoomIds } }, { $set: { isOccupied: false } });
  return result.modifiedCount || 0;
};

