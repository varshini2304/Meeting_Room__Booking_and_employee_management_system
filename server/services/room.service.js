import { Room } from "../models/room.model.js";
import { Booking } from "../models/booking.model.js";

/**
 * Authoritative Room Availability Service
 * Reusable domain service comparing Room inventory against active Booking records for a specific date and time slot.
 *
 * @param {Object} params
 * @param {string} params.date - YYYY-MM-DD
 * @param {string} params.startTime - HH:mm
 * @param {Object} [params.filters={}] - Optional room filters (branch, country, block, floor, roomNumber, roomType, capacity, isActive)
 * @returns {Promise<{ rooms: Array<Object>, allBooked: boolean, message: string|null }>}
 */
export const getRoomAvailabilityService = async ({ date, startTime, filters = {} }) => {
  if (!date || !startTime) {
    const error = new Error("date and startTime are required");
    error.statusCode = 400;
    throw error;
  }

  const queryFilters = {};

  const exactFields = ["country", "branch", "block", "floor", "roomNumber"];
  for (const f of exactFields) {
    if (filters[f]) {
      queryFilters[f] = String(filters[f]).trim();
    }
  }

  // Room type matching: support regex to match canonical types against legacy DB enums
  if (filters.roomType) {
    const cleanType = String(filters.roomType).trim();
    queryFilters.roomType = { $regex: new RegExp(cleanType, "i") };
  }

  if (filters.capacity !== undefined && filters.capacity !== null && !isNaN(Number(filters.capacity))) {
    queryFilters.capacity = { $gte: Number(filters.capacity) };
  }

  if (filters.isActive !== undefined) {
    queryFilters.isActive = typeof filters.isActive === "boolean" ? filters.isActive : filters.isActive === "true";
  } else {
    // Default to active rooms only if unspecified
    queryFilters.isActive = true;
  }

  const rooms = await Room.find(queryFilters).lean();

  // Find all active booked rooms for this date and time slot
  const booked = await Booking.find({ date, startTime, status: "booked" }).select("roomId").lean();
  const bookedRoomIds = new Set(booked.map((b) => String(b.roomId?._id || b.roomId)));

  const sanitizedRooms = rooms.map((room) => {
    const { secretCode, ...safeRoom } = room;
    return {
      ...safeRoom,
      isAvailable: !bookedRoomIds.has(String(room._id)),
    };
  });

  const allBooked = sanitizedRooms.length > 0 && sanitizedRooms.every((room) => !room.isAvailable);

  return {
    rooms: sanitizedRooms,
    allBooked,
    message: allBooked ? "All meeting rooms have been booked at this time." : null,
  };
};

/**
 * Authoritative Room Utilization Service
 * Computes concrete booking and occupancy counts for rooms within a date range.
 * Does NOT fabricate occupancy or utilization percentages.
 *
 * @param {Object} params
 * @param {string} [params.roomNumber]
 * @param {string} [params.branch]
 * @param {string} params.startDate - YYYY-MM-DD
 * @param {string} params.endDate - YYYY-MM-DD
 * @returns {Promise<{ startDate: string, endDate: string, totalRooms: number, rooms: Array<Object> }>}
 */
export const getRoomUtilizationService = async ({ roomNumber, branch, startDate, endDate }) => {
  if (!startDate || !endDate) {
    const error = new Error("startDate and endDate are required");
    error.statusCode = 400;
    throw error;
  }

  const roomFilter = { isActive: true };
  if (roomNumber) roomFilter.roomNumber = String(roomNumber).trim();
  if (branch) roomFilter.branch = String(branch).trim();

  const rooms = await Room.find(roomFilter).lean();
  const roomIds = rooms.map((r) => r._id);

  if (!roomIds.length) {
    return {
      startDate,
      endDate,
      totalRooms: 0,
      rooms: [],
    };
  }

  const bookings = await Booking.find({
    roomId: { $in: roomIds },
    date: { $gte: startDate, $lte: endDate },
  }).lean();

  const statsByRoomId = new Map();
  for (const r of rooms) {
    statsByRoomId.set(String(r._id), {
      roomId: String(r._id),
      roomNumber: r.roomNumber,
      branch: r.branch,
      block: r.block,
      floor: r.floor,
      roomType: r.roomType,
      capacity: r.capacity,
      totalBookings: 0,
      activeBookings: 0,
      completedBookings: 0,
      cancelledBookings: 0,
      confirmedCheckIns: 0,
    });
  }

  for (const b of bookings) {
    const stat = statsByRoomId.get(String(b.roomId?._id || b.roomId));
    if (!stat) continue;

    stat.totalBookings += 1;
    if (b.status === "booked") stat.activeBookings += 1;
    else if (b.status === "completed") stat.completedBookings += 1;
    else if (b.status === "cancelled") stat.cancelledBookings += 1;

    if (b.occupancyConfirmedAt) {
      stat.confirmedCheckIns += 1;
    }
  }

  return {
    startDate,
    endDate,
    totalRooms: rooms.length,
    rooms: Array.from(statsByRoomId.values()),
  };
};
