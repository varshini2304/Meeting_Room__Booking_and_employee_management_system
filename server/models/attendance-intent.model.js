import mongoose from "mongoose";

const attendanceIntentSchema = new mongoose.Schema(
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
    action: {
      type: String,
      enum: ["PUNCH_IN", "PUNCH_OUT"],
      required: true,
    },
    date: {
      type: String, // YYYY-MM-DD
      required: true,
    },
    stagedAtTime: {
      type: String, // HH:mm
      required: true,
    },
    location: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "expired", "cancelled"],
      default: "pending",
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 10 * 60 * 1000), // 10-minute validity
    },
    cleanupAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24-hour cleanup TTL
    },
    confirmedAt: {
      type: Date,
      default: null,
    },
    attendanceRecordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Attendance",
      default: null,
    },
  },
  { timestamps: true }
);

// Compound index for querying user's active intents
attendanceIntentSchema.index({ userId: 1, status: 1 });

// MongoDB Native TTL Index: Purges document 24 hours after creation
attendanceIntentSchema.index({ cleanupAt: 1 }, { expireAfterSeconds: 0 });

/**
 * Returns whether the attendance intent has surpassed its 10-minute business validity window.
 * @returns {boolean}
 */
attendanceIntentSchema.methods.isExpired = function () {
  return new Date() > this.expiresAt;
};

export const AttendanceIntent = mongoose.model("AttendanceIntent", attendanceIntentSchema);
