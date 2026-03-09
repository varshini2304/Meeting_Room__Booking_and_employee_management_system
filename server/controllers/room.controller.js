import { Booking } from "../models/booking.model.js";
import { Room } from "../models/room.model.js";

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

