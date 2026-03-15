import { Leave } from "../models/leave.model.js";
import { LeaveBalance } from "../models/leave-balance.model.js";
import { Attendance } from "../models/attendance.model.js";
import { User } from "../models/user.model.js";
import { createBulkNotifications, createNotification } from "./notification.service.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const LEAVE_TYPES = [
  "casual",
  "sick",
  "earned",
  "menstrual",
  "relocation",
  "unpaid",
  "maternity",
  "paternity",
];

const DEFAULTS = {
  casual:    12,
  sick:      10,
  earned:    12,
  menstrual: 12,
  relocation: 5,
  unpaid:    999,
  maternity: 90,
  paternity: 15,
};

/** Count business days (Mon–Fri) between two YYYY-MM-DD strings inclusive */
const countBusinessDays = (startDate, endDate, isHalfDay = false) => {
  const start = new Date(startDate + "T00:00:00");
  const end   = new Date(endDate   + "T00:00:00");
  if (start > end) return 0;
  let days = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) days++;
    cur.setDate(cur.getDate() + 1);
  }
  return isHalfDay ? 0.5 : days;
};

/** Ensure a LeaveBalance document exists for (employeeId, year); create with defaults if not */
export const ensureBalance = async (employeeId, year) => {
  let balance = await LeaveBalance.findOne({ employeeId, year });
  if (!balance) {
    balance = await LeaveBalance.create({ employeeId, year });
    if (year < 2026) {
      balance.earned.total = 15;
      await balance.save();
    }
  }
  return balance;
};

/** Compute remaining days for a type */
const remaining = (balance, type) => {
  const q = balance[type];
  if (!q) return 0;
  const total = type === "earned" ? Math.min(q.total, 45) : q.total;
  return Math.max(0, total - q.used - q.pending);
};

// ─── Apply for leave ─────────────────────────────────────────────────────────

export const applyLeave = async ({
  employeeId,
  leaveType,
  startDate,
  endDate,
  reason,
  isHalfDay = false,
  halfDayPeriod = "",
}) => {
  if (!LEAVE_TYPES.includes(leaveType)) {
    const err = new Error("Invalid leave type");
    err.statusCode = 400;
    throw err;
  }

  const employee = await User.findById(employeeId).select("name role gender").lean();

  // Gender-based leave rules
  if (leaveType === "menstrual" || leaveType === "maternity" || leaveType === "paternity") {
    const gender = employee?.gender || "unspecified";
    const needsFemale = leaveType === "menstrual" || leaveType === "maternity";
    const needsMale = leaveType === "paternity";
    if ((needsFemale && gender !== "female") || (needsMale && gender !== "male")) {
      const err = new Error(
        leaveType === "paternity"
          ? "Paternity leave is available only for male employees"
          : "This leave type is available only for female employees"
      );
      err.statusCode = 403;
      throw err;
    }
  }

  // Menstrual leave policy: max 1 day per month, non-accumulative
  if (leaveType === "menstrual") {
    const monthKey = startDate.slice(0, 7);
    const alreadyTaken = await Leave.findOne({
      employeeId,
      leaveType: "menstrual",
      status: { $in: ["pending", "approved"] },
      startDate: { $regex: `^${monthKey}` },
    });
    if (alreadyTaken) {
      const err = new Error("Menstrual leave already taken for this month");
      err.statusCode = 409;
      throw err;
    }
  }

  // Overlap check — no two active leaves on same dates
  const overlap = await Leave.findOne({
    employeeId,
    status: { $in: ["pending", "approved"] },
    $or: [
      { startDate: { $lte: endDate }, endDate: { $gte: startDate } },
    ],
  });
  if (overlap) {
    const err = new Error(
      `You already have a ${overlap.status} leave from ${overlap.startDate} to ${overlap.endDate}`
    );
    err.statusCode = 409;
    throw err;
  }

  const totalDays = countBusinessDays(startDate, endDate, isHalfDay);
  if (totalDays <= 0) {
    const err = new Error("Leave must span at least one business day");
    err.statusCode = 400;
    throw err;
  }
  if (leaveType === "menstrual" && totalDays > 1) {
    const err = new Error("Menstrual leave is limited to 1 day per month");
    err.statusCode = 400;
    throw err;
  }

  // Balance check (skip for unpaid — unlimited)
  if (leaveType !== "unpaid") {
    const year = new Date(startDate).getFullYear();
    const balance = await ensureBalance(employeeId, year);
    const rem = remaining(balance, leaveType);
    if (rem < totalDays) {
      const err = new Error(
        `Insufficient ${leaveType} leave balance. You have ${rem} days remaining, requested ${totalDays}`
      );
      err.statusCode = 422;
      throw err;
    }
    // Reserve as pending (or use immediately for managers)
    const isManager = employee?.role === "manager";
    await LeaveBalance.updateOne(
      { employeeId, year },
      {
        $inc: isManager
          ? { [`${leaveType}.used`]: totalDays }
          : { [`${leaveType}.pending`]: totalDays },
      }
    );
  }

  const isManager = employee?.role === "manager";
  const leave = await Leave.create({
    employeeId,
    leaveType,
    startDate,
    endDate,
    totalDays,
    reason,
    isHalfDay,
    halfDayPeriod,
    status: isManager ? "approved" : "pending",
    reviewedBy: isManager ? employeeId : null,
    reviewedAt: isManager ? new Date() : null,
    reviewNotes: isManager ? "Auto-approved (manager self-leave)" : "",
  });

  if (!isManager) {
    // Notify all managers
    const managers = await User.find({ role: "manager", isActive: true })
      .select("_id")
      .lean();
    if (managers.length) {
      await createBulkNotifications(
        managers.map((mgr) => ({
          userId: mgr._id,
          title: "New Leave Request",
          message: `${employee?.name || "An employee"} applied for ${leaveType} leave from ${startDate} to ${endDate}`,
          type: "system",
          metadata: { leaveId: leave._id, employeeId },
        }))
      );
    }
  } else {
    await _markAttendanceOnLeave(employeeId, startDate, endDate);
  }

  return leave;
};

// ─── Get my leaves ────────────────────────────────────────────────────────────

export const getMyLeaves = async (employeeId, { year, status } = {}) => {
  const query = { employeeId };
  if (year) {
    query.$or = [
      { startDate: { $regex: `^${year}` } },
      { endDate:   { $regex: `^${year}` } },
    ];
  }
  if (status) query.status = status;
  return Leave.find(query).sort({ createdAt: -1 }).lean();
};

// ─── Get my balance ───────────────────────────────────────────────────────────

export const getMyBalance = async (employeeId, year) => {
  const balance = await ensureBalance(employeeId, year);
  // Build computed remaining for each type
  const result = {};
  for (const type of LEAVE_TYPES) {
    const q = balance[type] || { total: DEFAULTS[type], used: 0, pending: 0 };
    const total = type === "earned" ? Math.min(q.total, 45) : q.total;
    result[type] = {
      total,
      used:      q.used,
      pending:   q.pending,
      remaining: Math.max(0, total - q.used - q.pending),
    };
  }
  return { year, ...result };
};

// ─── Cancel leave (employee) ──────────────────────────────────────────────────

export const cancelLeave = async (leaveId, employeeId) => {
  const leave = await Leave.findOne({ _id: leaveId, employeeId });
  if (!leave) {
    const err = new Error("Leave request not found");
    err.statusCode = 404;
    throw err;
  }
  if (leave.status === "approved") {
    const err = new Error("Cannot cancel an approved leave. Contact your manager.");
    err.statusCode = 400;
    throw err;
  }
  if (leave.status !== "pending") {
    const err = new Error("Only pending leaves can be cancelled");
    err.statusCode = 400;
    throw err;
  }

  // Release pending reservation
  if (leave.leaveType !== "unpaid") {
    const year = new Date(leave.startDate).getFullYear();
    await LeaveBalance.updateOne(
      { employeeId, year },
      { $inc: { [`${leave.leaveType}.pending`]: -leave.totalDays } }
    );
  }

  leave.status = "cancelled";
  await leave.save();
  return leave;
};

// ─── Approve leave (manager) ──────────────────────────────────────────────────

export const approveLeave = async (leaveId, managerId, notes = "") => {
  const leave = await Leave.findById(leaveId).populate("employeeId", "name _id");
  if (!leave) {
    const err = new Error("Leave request not found");
    err.statusCode = 404;
    throw err;
  }
  if (leave.status !== "pending") {
    const err = new Error(`Cannot approve a leave that is already ${leave.status}`);
    err.statusCode = 400;
    throw err;
  }

  const empId = leave.employeeId._id || leave.employeeId;
  const year  = new Date(leave.startDate).getFullYear();

  // Move from pending → used
  if (leave.leaveType !== "unpaid") {
    await LeaveBalance.updateOne(
      { employeeId: empId, year },
      {
        $inc: {
          [`${leave.leaveType}.used`]:    leave.totalDays,
          [`${leave.leaveType}.pending`]: -leave.totalDays,
        },
      }
    );
  }

  // Mark attendance records as on-leave for each day in range
  await _markAttendanceOnLeave(empId, leave.startDate, leave.endDate);

  leave.status     = "approved";
  leave.reviewedBy = managerId;
  leave.reviewedAt = new Date();
  leave.reviewNotes = notes;
  await leave.save();

  // Notify employee
  await createNotification({
    userId: empId,
    title: "Leave Approved ✓",
    message: `Your ${leave.leaveType} leave from ${leave.startDate} to ${leave.endDate} has been approved.`,
    type: "system",
    metadata: { leaveId: leave._id },
  });

  return leave;
};

// ─── Reject leave (manager) ───────────────────────────────────────────────────

export const rejectLeave = async (leaveId, managerId, notes = "") => {
  if (!notes.trim()) {
    const err = new Error("Rejection reason is required");
    err.statusCode = 400;
    throw err;
  }

  const leave = await Leave.findById(leaveId).populate("employeeId", "name _id");
  if (!leave) {
    const err = new Error("Leave request not found");
    err.statusCode = 404;
    throw err;
  }
  if (leave.status !== "pending") {
    const err = new Error(`Cannot reject a leave that is already ${leave.status}`);
    err.statusCode = 400;
    throw err;
  }

  const empId = leave.employeeId._id || leave.employeeId;
  const year  = new Date(leave.startDate).getFullYear();

  // Release pending reservation
  if (leave.leaveType !== "unpaid") {
    await LeaveBalance.updateOne(
      { employeeId: empId, year },
      { $inc: { [`${leave.leaveType}.pending`]: -leave.totalDays } }
    );
  }

  leave.status      = "rejected";
  leave.reviewedBy  = managerId;
  leave.reviewedAt  = new Date();
  leave.reviewNotes = notes;
  await leave.save();

  // Notify employee
  await createNotification({
    userId: empId,
    title: "Leave Rejected",
    message: `Your ${leave.leaveType} leave request was rejected. Reason: ${notes}`,
    type: "system",
    metadata: { leaveId: leave._id },
  });

  return leave;
};

// ─── Get all leaves (manager) ─────────────────────────────────────────────────

export const getAllLeaves = async ({ status, from, to, employeeId } = {}) => {
  const query = {};
  if (status)     query.status = status;
  if (employeeId) query.employeeId = employeeId;
  if (from || to) {
    query.startDate = {};
    if (from) query.startDate.$gte = from;
    if (to)   query.startDate.$lte = to;
  }
  return Leave.find(query)
    .populate("employeeId", "name email employeeId department")
    .populate("reviewedBy", "name")
    .sort({ createdAt: -1 })
    .lean();
};

// ─── Team calendar (who's off on which day) ───────────────────────────────────

export const getTeamCalendar = async (month, year) => {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 0);
  const end = `${year}-${String(month).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;

  const leaves = await Leave.find({
    status: "approved",
    startDate: { $lte: end },
    endDate:   { $gte: start },
  })
    .populate("employeeId", "name employeeId department")
    .lean();

  return leaves;
};

// ─── Adjust balance (manager) ─────────────────────────────────────────────────

export const adjustBalance = async (employeeId, year, updates) => {
  const balance = await ensureBalance(employeeId, year);
  for (const [type, vals] of Object.entries(updates)) {
    if (!LEAVE_TYPES.includes(type)) continue;
    if (vals.total !== undefined) {
      balance[type].total = type === "earned" ? Math.min(vals.total, 45) : vals.total;
    }
    if (vals.used  !== undefined) balance[type].used  = vals.used;
  }
  await balance.save();
  return balance;
};

// ─── Init balances for all active employees (new year) ───────────────────────

export const initYearBalances = async (year) => {
  const employees = await User.find({ isActive: true }).select("_id").lean();
  let created = 0;
  for (const emp of employees) {
    try {
      await LeaveBalance.findOneAndUpdate(
        { employeeId: emp._id, year },
        { $setOnInsert: { employeeId: emp._id, year } },
        { upsert: true }
      );
      created++;
    } catch {
      // already exists — fine
    }
  }
  return created;
};

// ─── Internal: mark attendance as on-leave ───────────────────────────────────

async function _markAttendanceOnLeave(employeeId, startDate, endDate) {
  const start = new Date(startDate + "T00:00:00");
  const end   = new Date(endDate   + "T00:00:00");
  const cur   = new Date(start);
  const bulk  = [];

  while (cur <= end) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) {
      const dateStr = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
      bulk.push({
        updateOne: {
          filter: { employeeId, date: dateStr },
          update: { $set: { status: "on-leave" } },
          upsert: true,
        },
      });
    }
    cur.setDate(cur.getDate() + 1);
  }

  if (bulk.length) {
    await Attendance.bulkWrite(bulk, { ordered: false });
  }
}
