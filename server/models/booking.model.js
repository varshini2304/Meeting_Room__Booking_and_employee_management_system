import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    startTime: { type: String, required: true }, // HH:mm
    endTime: { type: String, required: true }, // HH:mm
    invitedMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    secretCode: {
      type: String,
      default: () => String(Math.floor(100000 + Math.random() * 900000)),
      trim: true
    },
    status: { type: String, enum: ["booked", "cancelled"], default: "booked" },
    occupancyConfirmedAt: { type: Date, default: null },
    canceledAt: { type: Date, default: null }
  },
  { timestamps: true }
);

bookingSchema.index(
  { roomId: 1, date: 1, startTime: 1 },
  { unique: true, partialFilterExpression: { status: "booked" } }
);

export const Booking = mongoose.model("Booking", bookingSchema);

