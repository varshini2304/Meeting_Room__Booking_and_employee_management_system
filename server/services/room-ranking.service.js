import { Room } from "../models/room.model.js";
import { Booking } from "../models/booking.model.js";

/**
 * Checks if a room has a specific required amenity (case-insensitive, trimmed).
 * @param {string[]} roomAmenities
 * @param {string} requestedAmenity
 * @returns {boolean}
 */
export const matchesAmenity = (roomAmenities = [], requestedAmenity = "") => {
  if (!requestedAmenity || typeof requestedAmenity !== "string") return false;
  const target = requestedAmenity.trim().toLowerCase();
  return (roomAmenities || []).some((a) => typeof a === "string" && a.trim().toLowerCase() === target);
};

/**
 * Stage 1: Hard Filter
 * Non-negotiable exclusion rules:
 * 1. Room must be active
 * 2. Room capacity must be >= attendeeCount
 * 3. Room must not be booked for the requested date + startTime
 * 4. Every requested amenity MUST be present in room.amenities (case-insensitive)
 *
 * @param {Object} room - Room document or lean object
 * @param {Set<string>} bookedRoomIdSet - Set of booked room IDs for the requested slot
 * @param {Object} criteria - { attendeeCount, requestedAmenities }
 * @returns {boolean}
 */
export const passesHardFilter = (room, bookedRoomIdSet, criteria = {}) => {
  if (!room || !room.isActive) return false;

  // 1. Capacity check: independent constraint
  const attendeeCount = Math.max(1, Number(criteria.capacity || criteria.attendeeCount) || 1);
  if (room.capacity < attendeeCount) return false;

  // 2. Slot availability check
  const roomIdStr = String(room._id);
  if (bookedRoomIdSet && bookedRoomIdSet.has(roomIdStr)) return false;

  // 3. Explicit branch filter (if explicitly requested)
  if (criteria.requestedBranch && typeof criteria.requestedBranch === "string") {
    const targetBranch = criteria.requestedBranch.trim().toLowerCase();
    const roomBranch = (room.branch || "").trim().toLowerCase();
    if (targetBranch && roomBranch !== targetBranch) return false;
  }

  // 4. Explicit roomType filter (if requested, matches normalized type)
  if (criteria.roomType && typeof criteria.roomType === "string") {
    const targetType = criteria.roomType.trim().toLowerCase();
    const roomType = (room.roomType || "").trim().toLowerCase();
    if (targetType === "conference room" || targetType === "conference") {
      if (!roomType.includes("conference")) return false;
    } else if (targetType === "meeting room" || targetType === "meeting") {
      if (!roomType.includes("meeting")) return false;
    } else if (!roomType.includes(targetType)) {
      return false;
    }
  }

  // 5. Required amenities check (every requested amenity is a hard constraint)
  const requiredAmenities = criteria.requestedAmenities || [];
  for (const amenity of requiredAmenities) {
    if (!matchesAmenity(room.amenities, amenity)) {
      return false; // Drop candidate immediately if even 1 requested amenity is missing
    }
  }

  return true;
};

/**
 * Stage 2: Ranking Engine (Max 100 Points)
 * Evaluates rooms that passed Stage 1:
 * - Capacity Efficiency: Max 50 pts (rewarding the smallest sufficient room)
 * - Location Preference: Max 30 pts (branch match or country match)
 * - Bonus Amenities: Max 20 pts (extra perks beyond required)
 *
 * @param {Object} room
 * @param {Object} criteria - { attendeeCount, requestedAmenities, userBranch, userCountry }
 * @returns {{ totalScore: number, breakdown: { capacityScore: number, locationScore: number, bonusScore: number }, reason: string }}
 */
export const scoreRoomCandidate = (room, criteria) => {
  const attendeeCount = Math.max(1, Number(criteria.capacity || criteria.attendeeCount) || 1);
  const requiredAmenities = criteria.requestedAmenities || [];
  const userBranch = (criteria.userBranch || "").trim().toLowerCase();
  const userCountry = (criteria.userCountry || "").trim().toLowerCase();
  const roomBranch = (room.branch || "").trim().toLowerCase();
  const roomCountry = (room.country || "").trim().toLowerCase();

  // 1. Capacity Efficiency (Max 50 pts)
  // waste = (capacity - attendeeCount) / capacity
  const waste = Math.max(0, (room.capacity - attendeeCount) / room.capacity);
  let capacityScore = 5;
  let reason = `Accommodates ${attendeeCount} people (Capacity: ${room.capacity})`;
  if (waste <= 0.10) {
    capacityScore = 50; // exact or snug fit (<= 10% wasted capacity)
    reason = `Best fit: accommodates ${attendeeCount} people with minimal unused capacity (Capacity: ${room.capacity})`;
  } else if (waste <= 0.25) {
    capacityScore = 40; // good fit (<= 25% waste)
    reason = `Recommended: accommodates ${attendeeCount} people with low unused capacity (Capacity: ${room.capacity})`;
  } else if (waste <= 0.50) {
    capacityScore = 25; // acceptable fit (<= 50% waste)
    reason = `Suitable: accommodates ${attendeeCount} people with moderate capacity buffer (Capacity: ${room.capacity})`;
  } else if (waste <= 1.00) {
    capacityScore = 10; // oversized (<= 100% waste)
    reason = `Oversized: accommodates ${attendeeCount} people (Capacity: ${room.capacity})`;
  } else {
    capacityScore = 5;  // heavily oversized (> 100% waste)
    reason = `Significantly oversized for ${attendeeCount} people (Capacity: ${room.capacity})`;
  }

  // 2. Location Preference (Max 30 pts)
  let locationScore = 0;
  if (userBranch && roomBranch && roomBranch === userBranch) {
    locationScore = 30; // same branch match
  } else if (userCountry && roomCountry && roomCountry === userCountry) {
    locationScore = 15; // same country match
  }

  // 3. Bonus Amenities (Max 20 pts)
  const roomAmenitiesCount = (room.amenities || []).length;
  const bonusCount = Math.max(0, roomAmenitiesCount - requiredAmenities.length);
  let bonusScore = 0;
  if (bonusCount >= 3) {
    bonusScore = 20;
  } else if (bonusCount === 2) {
    bonusScore = 15;
  } else if (bonusCount === 1) {
    bonusScore = 10;
  } else {
    bonusScore = 0;
  }

  const totalScore = capacityScore + locationScore + bonusScore;

  return {
    totalScore,
    breakdown: {
      capacityScore,
      locationScore,
      bonusScore,
    },
    reason,
  };
};

/**
 * Runs Stage 1 Hard Filter and Stage 2 Deterministic Ranking over room candidates.
 *
 * @param {Array<Object>} rooms
 * @param {Set<string>} bookedRoomIdSet
 * @param {Object} criteria - { attendeeCount, requestedAmenities, userBranch, userCountry, roomType, requestedBranch }
 * @returns {Array<Object>} Ranked room candidates with scores and reasons
 */
export const rankRooms = (rooms = [], bookedRoomIdSet = new Set(), criteria = {}) => {
  const passingCandidates = [];

  for (const room of rooms) {
    if (passesHardFilter(room, bookedRoomIdSet, criteria)) {
      const scoring = scoreRoomCandidate(room, criteria);
      passingCandidates.push({
        room,
        score: scoring.totalScore,
        breakdown: scoring.breakdown,
        reason: scoring.reason,
      });
    }
  }

  // Sort descending by totalScore
  passingCandidates.sort((a, b) => b.score - a.score);

  return passingCandidates;
};

/**
 * Authoritative service method to find and rank available rooms for a given slot and criteria.
 *
 * @param {Object} params
 * @param {string} params.date - YYYY-MM-DD
 * @param {string} params.startTime - HH:mm
 * @param {number} [params.attendeeCount]
 * @param {number} [params.capacity]
 * @param {string[]} [params.requestedAmenities]
 * @param {string} [params.userBranch]
 * @param {string} [params.requestedBranch]
 * @param {string} [params.roomType]
 * @param {string} [params.userCountry]
 * @returns {Promise<{ candidates: Array<Object>, totalAvailableCount: number, requestedCriteria: Object }>}
 */
export const findAndRankAvailableRooms = async ({
  date,
  startTime,
  attendeeCount,
  capacity,
  requestedAmenities = [],
  userBranch = "",
  requestedBranch = "",
  roomType = "",
  userCountry = "",
}) => {
  const effectiveAttendeeCount = Number(capacity || attendeeCount) || 1;
  const effectiveBranch = requestedBranch || userBranch || "";

  // Query all active rooms in DB
  const [rooms, bookedList] = await Promise.all([
    Room.find({ isActive: true }).lean(),
    Booking.find({ date, startTime, status: "booked" }).select("roomId").lean(),
  ]);

  const bookedRoomIdSet = new Set(bookedList.map((b) => String(b.roomId)));

  const criteria = {
    attendeeCount: effectiveAttendeeCount,
    capacity: effectiveAttendeeCount,
    requestedAmenities,
    userBranch,
    requestedBranch: effectiveBranch,
    roomType,
    userCountry,
  };

  const ranked = rankRooms(rooms, bookedRoomIdSet, criteria);

  return {
    candidates: ranked.map((item) => ({
      roomId: String(item.room._id),
      roomNumber: item.room.roomNumber,
      roomType: item.room.roomType,
      capacity: item.room.capacity,
      branch: item.room.branch,
      block: item.room.block,
      floor: item.room.floor,
      amenities: item.room.amenities,
      score: item.score,
      scoreBreakdown: item.breakdown,
      recommendationReason: item.reason,
    })),
    totalAvailableCount: ranked.length,
    requestedCriteria: {
      date,
      startTime,
      attendeeCount: effectiveAttendeeCount,
      requestedAmenities,
      userBranch: effectiveBranch,
      roomType,
    },
  };
};
