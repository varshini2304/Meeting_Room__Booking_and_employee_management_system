import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    date: {
      type: String, // YYYY-MM-DD
      required: true,
      index: true,
    },
    checkInTime: { type: Date, default: null },
    checkOutTime: { type: Date, default: null },
    status: {
      type: String,
      enum: ["present", "absent", "late", "half-day", "on-leave"],
      default: "absent",
    },
    workHours: { type: Number, default: 0 }, // auto-calculated on checkout
    location: { type: String, default: "", trim: true },
    notes: { type: String, default: "", trim: true },
    isManualOverride: { type: Boolean, default: false },
    overriddenBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    overrideReason: { type: String, default: "", trim: true },
    correctionRequest: {
      status: { type: String, enum: ["pending", "approved", "rejected"] },
      requestedCheckInTime: { type: Date, default: null },
      requestedCheckOutTime: { type: Date, default: null },
      reason: { type: String, default: "", trim: true },
      requestedAt: { type: Date, default: null },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      reviewedAt: { type: Date, default: null },
      reviewerNotes: { type: String, default: "", trim: true },
    },
  },
  { timestamps: true }
);

// One attendance record per employee per day
attendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });

export const Attendance = mongoose.model("Attendance", attendanceSchema);
