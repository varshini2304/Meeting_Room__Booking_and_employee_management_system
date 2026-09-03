import mongoose from "mongoose";
import { LEAVE_TYPES } from "../services/leave.service.js";

const leaveIntentSchema = new mongoose.Schema(
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
    leaveType: {
      type: String,
      enum: LEAVE_TYPES,
      required: true,
    },
    startDate: {
      type: String,
      required: true,
      trim: true,
    },
    endDate: {
      type: String,
      required: true,
      trim: true,
    },
    totalDays: {
      type: Number,
      required: true,
      min: 0.5,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    isHalfDay: {
      type: Boolean,
      default: false,
    },
    halfDayPeriod: {
      type: String,
      enum: ["morning", "afternoon", ""],
      default: "",
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
      index: true,
    },
    cleanupAt: {
      type: Date,
      required: true,
    },
    confirmedAt: {
      type: Date,
      default: null,
    },
    leaveId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Leave",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Native MongoDB TTL index: automatically purges documents 24 hours after staging
leaveIntentSchema.index({ cleanupAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for user lookups
leaveIntentSchema.index({ userId: 1, status: 1 });

/**
 * Checks whether the staged intent has exceeded its 10-minute application lifecycle.
 */
leaveIntentSchema.methods.isExpired = function () {
  return Date.now() > this.expiresAt.getTime();
};

export const LeaveIntent = mongoose.model("LeaveIntent", leaveIntentSchema);
