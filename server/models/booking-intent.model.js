import mongoose from "mongoose";

const bookingIntentSchema = new mongoose.Schema(
  {
    intentId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    sessionId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Target Room Details
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },
    roomNumber: {
      type: String,
      required: true,
      trim: true,
    },
    roomType: {
      type: String,
      required: true,
      trim: true,
    },
    branch: {
      type: String,
      default: "",
      trim: true,
    },
    block: {
      type: String,
      default: "",
      trim: true,
    },
    floor: {
      type: String,
      default: "",
      trim: true,
    },

    // Meeting Schedule
    date: {
      type: String,
      required: true,
      trim: true, // YYYY-MM-DD
    },
    startTime: {
      type: String,
      required: true,
      trim: true, // HH:mm (:00 or :30)
    },
    endTime: {
      type: String,
      required: true,
      trim: true, // HH:mm (startTime + 30m)
    },

    // Meeting Context & Metadata
    title: {
      type: String,
      default: "",
      trim: true,
    },
    attendeeCount: {
      type: Number,
      required: true,
      min: 1,
    },
    requestedAmenities: {
      type: [String],
      default: [],
    },
    invitedMembers: {
      type: [String],
      default: [], // Email addresses or participant strings
    },

    // Transaction State
    status: {
      type: String,
      enum: ["pending", "confirmed", "expired", "cancelled"],
      default: "pending",
      index: true,
    },

    // Dual-Timestamp Lifecycle
    // 1. expiresAt: 10-minute business logic expiry. Confirm attempts after this return HTTP 410.
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 10 * 60 * 1000), // now + 10m
    },
    // 2. cleanupAt: 24-hour database TTL index. Document is purged after 24h for audit/triage retention.
    cleanupAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // now + 24h
    },

    confirmedAt: {
      type: Date,
      default: null,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      default: null,
    },
  },
  { timestamps: true }
);

// Compound index for querying user's active intents
bookingIntentSchema.index({ userId: 1, status: 1 });

// MongoDB Native TTL Index: Purges document 24 hours after creation
bookingIntentSchema.index({ cleanupAt: 1 }, { expireAfterSeconds: 0 });

/**
 * Returns whether the intent has surpassed its 10-minute business validity window.
 * @returns {boolean}
 */
bookingIntentSchema.methods.isExpired = function () {
  return new Date() > this.expiresAt;
};

export const BookingIntent = mongoose.model("BookingIntent", bookingIntentSchema);
