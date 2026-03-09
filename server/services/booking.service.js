import { Booking } from "../models/booking.model.js";
import { Room } from "../models/room.model.js";
import { User } from "../models/user.model.js";
import { addThirtyMinutes, isValidHalfHourSlot } from "../utils/generateSlots.js";
import { createBulkNotifications, createNotification } from "./notification.service.js";
import { sendBookingConfirmationEmail } from "./email.service.js";

export const createBooking = async ({ ownerId, roomId, date, startTime, invitedMembers = [] }) => {
  if (!isValidHalfHourSlot(startTime)) {
    const err = new Error("startTime must match HH:mm and be in 30-minute slots");
    err.statusCode = 400;
    throw err;
  }

  const endTime = addThirtyMinutes(startTime);
  const booking = await Booking.create({ ownerId, roomId, date, startTime, endTime, invitedMembers, status: "booked" });
  const room = await Room.findById(roomId).lean();
  const owner = await User.findById(ownerId).lean();

  if (owner?.email && room) {
    await sendBookingConfirmationEmail({
      to: owner.email,
      roomName: `${room.branch}-${room.block}-${room.roomNumber}`,
      date,
      startTime,
      endTime
    });
  }

  if (invitedMembers.length) {
    await createBulkNotifications(
      invitedMembers.map((userId) => ({
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

