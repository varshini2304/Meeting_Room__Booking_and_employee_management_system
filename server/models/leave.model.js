import mongoose from "mongoose";

const leaveSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    leaveType: {
      type: String,
      enum: [
        "casual",
        "sick",
        "earned",
        "menstrual",
        "relocation",
        "unpaid",
        "maternity",
        "paternity",
      ],
      required: true,
    },
    startDate: { type: String, required: true }, // YYYY-MM-DD
    endDate:   { type: String, required: true }, // YYYY-MM-DD
    totalDays: { type: Number, required: true, min: 0.5 },
    reason:    { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
      default: "pending",
      index: true,
    },
    reviewedBy:    { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt:    { type: Date, default: null },
    reviewNotes:   { type: String, default: "", trim: true },
    isHalfDay:     { type: Boolean, default: false },
    halfDayPeriod: { type: String, enum: ["morning", "afternoon", ""], default: "" },
  },
  { timestamps: true }
);

leaveSchema.index({ employeeId: 1, startDate: 1 });
leaveSchema.index({ status: 1, startDate: 1 });

export const Leave = mongoose.model("Leave", leaveSchema);
