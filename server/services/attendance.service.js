import { Attendance } from "../models/attendance.model.js";
import { User } from "../models/user.model.js";
import { createBulkNotifications, createNotification } from "./notification.service.js";

// Configurable late threshold: 09:00 AM
const LATE_THRESHOLD_HOUR = 9;
const LATE_THRESHOLD_MINUTE = 0;

const pad = (n) => String(n).padStart(2, "0");

export const getTodayDateStr = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

const getStatusFromCheckIn = (checkInTime) => {
  const h = checkInTime.getHours();
  const m = checkInTime.getMinutes();
  if (
    h > LATE_THRESHOLD_HOUR ||
    (h === LATE_THRESHOLD_HOUR && m > LATE_THRESHOLD_MINUTE)
  ) {
    return "late";
  }
  return "present";
};

const calcWorkHours = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return 0;
  const ms = checkOut.getTime() - checkIn.getTime();
  return Math.max(0, Math.round((ms / (1000 * 60 * 60)) * 100) / 100);
};

const computeStatus = (checkInTime, checkOutTime) => {
  if (!checkInTime) return "absent";
  const base = getStatusFromCheckIn(checkInTime);
  if (!checkOutTime) return base;
  const workHours = calcWorkHours(checkInTime, checkOutTime);
  if (workHours > 0 && workHours < 4) return "half-day";
  return base === "late" ? "late" : "present";
};

// ─── Check In ────────────────────────────────────────────────────────────────

export const checkIn = async ({ userId, location = "" }) => {
  const date = getTodayDateStr();
  const now = new Date();

  const existing = await Attendance.findOne({ employeeId: userId, date });
  if (existing?.checkInTime) {
    const err = new Error("Already checked in today");
    err.statusCode = 409;
    throw err;
  }

  const status = getStatusFromCheckIn(now);

  const record = await Attendance.findOneAndUpdate(
    { employeeId: userId, date },
    {
      $set: {
        checkInTime: now,
        status,
        location,
      },
    },
    { upsert: true, new: true }
  );

  return record;
};

// ─── Check Out ───────────────────────────────────────────────────────────────

export const checkOut = async ({ userId }) => {
  const date = getTodayDateStr();
  const now = new Date();

  const record = await Attendance.findOne({ employeeId: userId, date });
  if (!record?.checkInTime) {
    const err = new Error("You have not checked in today");
    err.statusCode = 400;
    throw err;
  }
  if (record.checkOutTime) {
    const err = new Error("Already checked out today");
    err.statusCode = 409;
    throw err;
  }

  const workHours = calcWorkHours(record.checkInTime, now);
  const status =
    workHours > 0 && workHours < 4
      ? "half-day"
      : record.status === "late"
      ? "late"
      : "present";

  record.checkOutTime = now;
  record.workHours = workHours;
  record.status = status;
  await record.save();

  return record;
};

// ─── Get today's record for a user ───────────────────────────────────────────

export const getTodayRecord = async (userId) => {
  const date = getTodayDateStr();
  return Attendance.findOne({ employeeId: userId, date }).lean();
};

// ─── My history (paginated) ───────────────────────────────────────────────────

export const getMyHistory = async ({ userId, month, year }) => {
  const query = { employeeId: userId };
  if (month && year) {
    const m = String(month).padStart(2, "0");
    query.date = { $regex: `^${year}-${m}` };
  }
  return Attendance.find(query).sort({ date: -1 }).lean();
};

// ─── Monthly summary for one user ────────────────────────────────────────────

export const getMonthlySummary = async ({ userId, month, year }) => {
  const m = String(month).padStart(2, "0");
  const records = await Attendance.find({
    employeeId: userId,
    date: { $regex: `^${year}-${m}` },
  }).lean();

  const summary = {
    present: 0,
    absent: 0,
    late: 0,
    halfDay: 0,
    onLeave: 0,
    totalWorkHours: 0,
    avgWorkHours: 0,
  };

  for (const r of records) {
    summary.totalWorkHours += r.workHours || 0;
    if (r.status === "present") summary.present++;
    else if (r.status === "absent") summary.absent++;
    else if (r.status === "late") { summary.late++; summary.present++; }
    else if (r.status === "half-day") summary.halfDay++;
    else if (r.status === "on-leave") summary.onLeave++;
  }

  const workedDays = records.filter((r) => r.checkInTime).length;
  summary.avgWorkHours =
    workedDays > 0
      ? Math.round((summary.totalWorkHours / workedDays) * 100) / 100
      : 0;

  return { ...summary, records };
};

// ─── All attendance for a date (manager) ─────────────────────────────────────

export const getAllForDate = async (date) => {
  const dayOfWeek = new Date(date + "T00:00:00").getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const employees = await User.find({
    role: { $in: ["employee", "manager"] },
    $or: [{ isActive: true }, { isActive: { $exists: false } }],
  })
    .select("_id name email employeeId department designation")
    .lean();

  const records = await Attendance.find({ date }).lean();
  const recordMap = new Map(records.map((r) => [String(r.employeeId), r]));

  return employees.map((emp) => {
    const rec = recordMap.get(String(emp._id));
    return {
      employee: emp,
      date,
      checkInTime: rec?.checkInTime || null,
      checkOutTime: rec?.checkOutTime || null,
      status: rec?.status || (isWeekend ? "weekend" : "absent"),
      workHours: rec?.workHours || 0,
      recordId: rec?._id || null,
      correctionRequest: rec?.correctionRequest || null,
    };
  });
};

// ─── Date range report (manager) ─────────────────────────────────────────────

export const getDateRangeReport = async ({ from, to, employeeId }) => {
  const query = { date: { $gte: from, $lte: to } };
  if (employeeId) query.employeeId = employeeId;

  const records = await Attendance.find(query)
    .populate("employeeId", "name email employeeId department designation")
    .sort({ date: 1 })
    .lean();

  return records;
};

// ─── Manual override (manager) ───────────────────────────────────────────────

export const overrideAttendance = async ({
  recordId,
  managerId,
  status,
  notes,
  checkInTime,
  checkOutTime,
}) => {
  const update = {
    isManualOverride: true,
    overriddenBy: managerId,
    overrideReason: notes || "",
    status,
  };
  if (checkInTime) update.checkInTime = new Date(checkInTime);
  if (checkOutTime) {
    update.checkOutTime = new Date(checkOutTime);
    if (update.checkInTime || checkInTime) {
      update.workHours = calcWorkHours(
        update.checkInTime || new Date(checkInTime),
        new Date(checkOutTime)
      );
    }
  }

  const record = await Attendance.findByIdAndUpdate(recordId, { $set: update }, { new: true });
  if (!record) {
    const err = new Error("Attendance record not found");
    err.statusCode = 404;
    throw err;
  }
  return record;
};

// ─── Cron: auto-mark absent ───────────────────────────────────────────────────

export const markAbsentForToday = async () => {
  const date = getTodayDateStr();
  const dayOfWeek = new Date(date + "T00:00:00").getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) return 0;
  const employees = await User.find({ $or: [{ isActive: true }, { isActive: { $exists: false } }] })
    .select("_id")
    .lean();

  let marked = 0;
  for (const emp of employees) {
    try {
      await Attendance.findOneAndUpdate(
        { employeeId: emp._id, date },
        { $setOnInsert: { employeeId: emp._id, date, status: "absent" } },
        { upsert: true }
      );
      marked++;
    } catch {
      // ignore duplicate key errors for already-existing records
    }
  }
  return marked;
};

// ─── Employee correction request ─────────────────────────────────────────────

export const requestCorrection = async ({
  userId,
  date,
  requestedCheckInTime,
  requestedCheckOutTime,
  reason = "",
}) => {
  if (!date) {
    const err = new Error("date is required");
    err.statusCode = 400;
    throw err;
  }

  const record = await Attendance.findOneAndUpdate(
    { employeeId: userId, date },
    { $setOnInsert: { employeeId: userId, date, status: "absent" } },
    { upsert: true, new: true }
  );

  record.correctionRequest = {
    status: "pending",
    requestedCheckInTime: requestedCheckInTime ? new Date(requestedCheckInTime) : null,
    requestedCheckOutTime: requestedCheckOutTime ? new Date(requestedCheckOutTime) : null,
    reason: String(reason || "").trim(),
    requestedAt: new Date(),
    reviewedBy: null,
    reviewedAt: null,
    reviewerNotes: "",
  };

  await record.save();

  const employee = await User.findById(userId).select("name employeeId").lean();
  const managers = await User.find({ role: "manager", isActive: true })
    .select("_id")
    .lean();
  if (managers.length) {
    await createBulkNotifications(
      managers.map((mgr) => ({
        userId: mgr._id,
        title: "Attendance correction request",
        message: `${employee?.name || "Employee"} (${employee?.employeeId || ""}) requested a correction for ${date}.`,
        type: "system",
        metadata: { attendanceId: record._id, employeeId: userId, date },
      }))
    );
  }

  return record;
};

// ─── Manager approves/rejects correction ─────────────────────────────────────

export const reviewCorrection = async ({ recordId, managerId, action, notes = "" }) => {
  const record = await Attendance.findById(recordId);
  if (!record) {
    const err = new Error("Attendance record not found");
    err.statusCode = 404;
    throw err;
  }

  if (!record.correctionRequest || record.correctionRequest.status !== "pending") {
    const err = new Error("No pending correction request found");
    err.statusCode = 400;
    throw err;
  }

  if (action === "approve") {
    const requestedIn = record.correctionRequest.requestedCheckInTime;
    const requestedOut = record.correctionRequest.requestedCheckOutTime;
    record.checkInTime = requestedIn || record.checkInTime || null;
    record.checkOutTime = requestedOut || record.checkOutTime || null;
    record.workHours = calcWorkHours(record.checkInTime, record.checkOutTime);
    record.status = computeStatus(record.checkInTime, record.checkOutTime);
    record.isManualOverride = true;
    record.overriddenBy = managerId;
    record.overrideReason = notes || "Correction approved";
  }

  record.correctionRequest.status = action === "approve" ? "approved" : "rejected";
  record.correctionRequest.reviewedBy = managerId;
  record.correctionRequest.reviewedAt = new Date();
  record.correctionRequest.reviewerNotes = notes || "";

  await record.save();

  await createNotification({
    userId: record.employeeId,
    title: action === "approve" ? "Correction approved" : "Correction rejected",
    message:
      action === "approve"
        ? `Your attendance correction for ${record.date} has been approved.`
        : `Your attendance correction for ${record.date} was rejected. ${notes ? `Reason: ${notes}` : ""}`,
    type: "system",
    metadata: { attendanceId: record._id, date: record.date },
  });

  return record;
};
