import { Booking } from "../models/booking.model.js";
import { Room } from "../models/room.model.js";
import { User } from "../models/user.model.js";

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
    const room = await Room.create(req.body);
    res.status(201).json(room);
  } catch (error) {
    next(error);
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

    const rooms = await Room.find(buildRoomFilters(req.query)).lean();
    const booked = await Booking.find({ date, startTime, status: "booked" }).select("roomId").lean();
    const bookedRoomIds = new Set(booked.map((b) => String(b.roomId)));
    const response = rooms.map((room) => ({ ...room, isAvailable: !bookedRoomIds.has(String(room._id)) }));
    res.json(response);
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
    room = await ensureRoomSecretCode(room);
    const roomPayload = room.toObject();

    const now = new Date();
    const booking = await Booking.findOne({ roomId: room._id, status: "booked" })
      .populate("ownerId", "name email employeeId")
      .lean();

    if (!booking || !isWithinBookingWindow(booking, now)) {
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
        booking: null,
        secretCode: roomPayload.secretCode
      });
    }

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
      booking: {
        id: booking._id,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        owner: booking.ownerId
          ? {
              name: booking.ownerId.name,
              email: booking.ownerId.email,
              employeeId: booking.ownerId.employeeId,
            }
          : null,
      },
      secretCode: roomPayload.secretCode
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

    let room = await Room.findOne({
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

    return res.json({
      message: "Secret key fetched successfully",
      roomNumber: room.roomNumber,
      secretCode: room.secretCode,
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

    let room = await Room.findOne({
      roomNumber: String(roomNumber).trim(),
      isActive: true,
    });

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    room = await ensureRoomSecretCode(room);

    if (String(room.secretCode) !== String(secretCode).trim()) {
      return res.status(403).json({ message: "Invalid secret code" });
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

    if (!booking) {
      return res.status(403).json({ message: "No active booking found for this room" });
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
      return res.status(400).json({ message: "Check-in window has expired. Booking cancelled." });
    }

    if (!booking.occupancyConfirmedAt) {
      booking.occupancyConfirmedAt = now;
      await booking.save();
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
