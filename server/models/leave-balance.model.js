import mongoose from "mongoose";

const quotaSchema = new mongoose.Schema(
  {
    total:     { type: Number, default: 0 },
    used:      { type: Number, default: 0 },
    pending:   { type: Number, default: 0 },
  },
  { _id: false }
);

const leaveBalanceSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    year:       { type: Number, required: true },
    casual:     { type: quotaSchema, default: () => ({ total: 12, used: 0, pending: 0 }) },
    sick:       { type: quotaSchema, default: () => ({ total: 10, used: 0, pending: 0 }) },
    earned:     { type: quotaSchema, default: () => ({ total: 12, used: 0, pending: 0 }) },
    menstrual:  { type: quotaSchema, default: () => ({ total: 12, used: 0, pending: 0 }) },
    relocation: { type: quotaSchema, default: () => ({ total: 5, used: 0, pending: 0 }) },
    unpaid:     { type: quotaSchema, default: () => ({ total: 999, used: 0, pending: 0 }) },
    maternity:  { type: quotaSchema, default: () => ({ total: 90, used: 0, pending: 0 }) },
    paternity:  { type: quotaSchema, default: () => ({ total: 15, used: 0, pending: 0 }) },
  },
  { timestamps: true }
);

leaveBalanceSchema.index({ employeeId: 1, year: 1 }, { unique: true });

export const LeaveBalance = mongoose.model("LeaveBalance", leaveBalanceSchema);
