import { Booking } from "../models/booking.model.js";
import { Room } from "../models/room.model.js";
import { User } from "../models/user.model.js";
import { createBulkNotifications } from "../services/notification.service.js";
import { sendRoomDeletedCancellationEmail } from "../services/email.service.js";
import { getRoomAvailabilityService } from "../services/room.service.js";

const MAX_ROOMS = 6;

const buildRoomLabel = (room) => `${room.branch}-${room.block}-${room.roomNumber}`;
const buildRoomLocation = (room) =>
  `${room.country}, ${room.branch}, ${room.block}, ${room.floor}`;

const toDateTime = (date, time) => new Date(`${date}T${time}:00`);
const getCheckInCutoff = (date, startTime) => {
  const start = toDateTime(date, startTime);
  return new Date(start.getTime() + 10 * 60 * 1000);
};
const isWithinBookingWindow = (booking, now) => {
  const startAt = toDateTime(booking.date, booking.startTime);
  const endAt = toDateTime(booking.date, booking.endTime);
  return now >= startAt && now <= endAt;
};
const ensureRoomSecretCode = async (room) => {
  if (room.secretCode) return room;
  room.secretCode = String(Math.floor(100000 + Math.random() * 900000));
  await room.save();
  return room;
};
const ensureBookingSecretCode = async (booking) => {
  if (booking.secretCode) return booking.secretCode;
  const generated = String(Math.floor(100000 + Math.random() * 900000));
  await Booking.updateOne({ _id: booking._id }, { $set: { secretCode: generated } });
  return generated;
};

const buildRoomFilters = (query) => {
  const fields = ["country", "branch", "block", "floor", "roomNumber", "roomType"];
  const filters = {};
  for (const field of fields) {
    if (query[field]) filters[field] = query[field];
  }
  if (query.capacity) filters.capacity = { $gte: Number(query.capacity) };
  if (query.isActive !== undefined) filters.isActive = query.isActive === "true";
  return filters;
};

export const createRoom = async (req, res, next) => {
  try {
    const existingCount = await Room.countDocuments();
    if (existingCount >= MAX_ROOMS) {
      return res.status(400).json({
        message: `Maximum number of rooms (${MAX_ROOMS}) reached. Cannot create more rooms.`,
      });
    }
    const room = await Room.create(req.body);
    return res.status(201).json(room);
  } catch (error) {
    return next(error);
  }
};

export const editRoom = async (req, res, next) => {
  try {
    const room = await Room.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!room) return res.status(404).json({ message: "Room not found" });
    return res.json(room);
  } catch (error) {
    return next(error);
  }
};

export const deleteRoom = async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: "Room not found" });

    const roomLabel = buildRoomLabel(room);
    const roomLocation = buildRoomLocation(room);
    const now = new Date();

    const activeBookings = await Booking.find({ roomId: room._id, status: "booked" }).lean();

    if (activeBookings.length > 0) {
      const bookingIds = activeBookings.map((b) => b._id);
      await Booking.updateMany(
        { _id: { $in: bookingIds } },
        { $set: { status: "cancelled", canceledAt: now } },
      );

      const ownerIds = [...new Set(activeBookings.map((b) => String(b.ownerId)))];
      const owners = await User.find({ _id: { $in: ownerIds } }).lean();
      const ownersById = new Map(owners.map((u) => [String(u._id), u]));

      await createBulkNotifications(
        activeBookings.map((b) => ({
          userId: b.ownerId,
          title: "Booking Cancelled — Room Removed",
          message: `Your booking for ${roomLabel} on ${b.date} ${b.startTime}-${b.endTime} was cancelled because the room was deleted by a manager.`,
          type: "system",
          metadata: { bookingId: b._id, roomId: room._id, reason: "room_deleted" },
        })),
      );

      await Promise.all(
        activeBookings.map((b) => {
          const owner = ownersById.get(String(b.ownerId));
          if (!owner?.email) return Promise.resolve();
          return sendRoomDeletedCancellationEmail({
            to: owner.email,
            ownerName: owner.name,
            roomName: roomLabel,
            location: roomLocation,
            date: b.date,
            startTime: b.startTime,
            endTime: b.endTime,
          });
        }),
      );
    }

    await Room.deleteOne({ _id: room._id });
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
};

export const getRooms = async (req, res, next) => {
  try {
    const rooms = await Room.find(buildRoomFilters(req.query)).sort({ createdAt: -1 });
    res.json(rooms);
  } catch (error) {
    next(error);
  }
};

export const getRoomAvailability = async (req, res, next) => {
  try {
    const { date, startTime } = req.query;
    if (!date || !startTime) return res.status(400).json({ message: "date and startTime are required" });

    const result = await getRoomAvailabilityService({ date, startTime, filters: req.query });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getPublicRoomList = async (req, res, next) => {
  try {
    const rooms = await Room.find({ isActive: true })
      .select("roomNumber roomType capacity country branch block floor")
      .sort({ roomNumber: 1 })
      .lean();
    res.json(rooms);
  } catch (error) {
    next(error);
  }
};

export const getActiveRoomBooking = async (req, res, next) => {
  try {
    const { roomNumber } = req.query;
    if (!roomNumber) return res.status(400).json({ message: "roomNumber is required" });

    let room = await Room.findOne({ roomNumber: String(roomNumber).trim(), isActive: true });
    if (!room) return res.status(404).json({ message: "Room not found" });
    const roomPayload = room.toObject();

    const now = new Date();
    const bookings = await Booking.find({
      roomId: room._id,
      status: { $in: ["booked", "BOOKED", "checked_in", "CHECKED_IN"] }
    })
      .sort({ date: 1, startTime: 1 })
      .populate("ownerId", "name email employeeId")
      .lean();

    const mapBooking = (b) => ({
      id: b._id,
      date: b.date,
      startTime: b.startTime,
      endTime: b.endTime,
      owner: b.ownerId
        ? {
            name: b.ownerId.name,
            email: b.ownerId.email,
            employeeId: b.ownerId.employeeId,
          }
        : null,
    });

    let activeBooking = null;
    let nextBooking = null;
    const upcomingBookings = [];

    for (const b of bookings) {
      const startAt = toDateTime(b.date, b.startTime);
      const endAt = toDateTime(b.date, b.endTime);
      if (now >= startAt && now <= endAt) {
        activeBooking = b;
      }
      if (startAt > now) {
        if (!nextBooking) {
          nextBooking = b;
        }
        if (upcomingBookings.length < 3) {
          upcomingBookings.push(b);
        }
      }
    }

    const status = activeBooking ? "booked" : nextBooking ? "upcoming" : "available";
    const activeSecret = activeBooking ? await ensureBookingSecretCode(activeBooking) : null;
    const nextSecret = !activeBooking && nextBooking ? await ensureBookingSecretCode(nextBooking) : null;

    return res.json({
      room: {
        roomNumber: roomPayload.roomNumber,
        roomType: roomPayload.roomType,
        capacity: roomPayload.capacity,
        country: roomPayload.country,
        branch: roomPayload.branch,
        block: roomPayload.block,
        floor: roomPayload.floor,
      },
      booking: activeBooking ? mapBooking(activeBooking) : null,
      nextBooking: !activeBooking && nextBooking ? mapBooking(nextBooking) : null,
      upcomingBookings: upcomingBookings.map(mapBooking),
      status,
      secretCode: activeSecret || nextSecret
    });
  } catch (error) {
    return next(error);
  }
};

export const revealRoomSecretCode = async (req, res, next) => {
  try {
    const { roomNumber, email } = req.body;

    if (!roomNumber || !email) {
      return res.status(400).json({ message: "roomNumber and email are required" });
    }

    const room = await Room.findOne({
      roomNumber: String(roomNumber).trim(),
      isActive: true,
    });

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    const user = await User.findOne({
      email: String(email).trim().toLowerCase(),
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const now = new Date();
    const booking = await Booking.findOne({
      ownerId: user._id,
      roomId: room._id,
      status: "booked",
    });

    if (!booking || !isWithinBookingWindow(booking, now)) {
      return res.status(403).json({
        message: "This email does not have a valid booking window for this room",
      });
    }

    const secretCode = await ensureBookingSecretCode(booking);

    return res.json({
      message: "Secret key fetched successfully",
      roomNumber: room.roomNumber,
      secretCode,
    });
  } catch (error) {
    return next(error);
  }
};

export const confirmRoomCheckIn = async (req, res, next) => {
  try {
    const { roomNumber, email, secretCode } = req.body;

    if (!roomNumber || !email || !secretCode) {
      return res.status(400).json({ message: "roomNumber, email and secretCode are required" });
    }

    const room = await Room.findOne({
      roomNumber: String(roomNumber).trim(),
      isActive: true,
    });

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    const user = await User.findOne({
      email: String(email).trim().toLowerCase(),
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const now = new Date();
    const booking = await Booking.findOne({
      ownerId: user._id,
      roomId: room._id,
      status: { $in: ["booked", "BOOKED"] },
    });

    if (!booking) {
      return res.status(403).json({ message: "No active booking found for this room" });
    }

    const bookingSecret = await ensureBookingSecretCode(booking);
    if (String(bookingSecret) !== String(secretCode).trim()) {
      return res.status(403).json({ message: "Invalid secret code" });
    }

    const startAt = toDateTime(booking.date, booking.startTime);
    const cutoffAt = getCheckInCutoff(booking.date, booking.startTime);

    if (now < startAt) {
      return res.status(400).json({ message: "Check-in opens at meeting start time" });
    }

    if (now > cutoffAt) {
      booking.status = "cancelled";
      booking.canceledAt = now;
      await booking.save();
      room.isOccupied = false;
      await room.save();
      return res.status(400).json({ message: "Check-in window has expired. Booking cancelled." });
    }

    if (!booking.occupancyConfirmedAt) {
      booking.occupancyConfirmedAt = now;
      await booking.save();
    }
    if (!room.isOccupied) {
      room.isOccupied = true;
      await room.save();
    }

    return res.json({
      message: "Check-in confirmed",
      bookingId: booking._id,
      occupancyConfirmedAt: booking.occupancyConfirmedAt,
    });
  } catch (error) {
    return next(error);
  }
};
