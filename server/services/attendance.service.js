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

// ─── Phase 13: Manager Attendance Intelligence Domain Services ────────────────

/**
 * Resolves employees by name against the User directory.
 * Disambiguation returns minimum identifiers: name, employeeId, department, branch.
 * Email is strictly excluded to preserve privacy.
 *
 * @param {string} employeeName
 * @param {string} [branch]
 * @returns {Promise<{ employeeMatchStatus: 'NOT_FOUND'|'AMBIGUOUS'|'MATCHED', matchedEmployees: Array<Object>, user: Object|null }>}
 */
export const resolveEmployeeDirectory = async (employeeName, branch) => {
  if (!employeeName || typeof employeeName !== "string" || !employeeName.trim()) {
    return { employeeMatchStatus: "NONE", matchedEmployees: [], user: null };
  }

  const cleanName = employeeName.trim();
  const query = {
    name: { $regex: new RegExp(cleanName, "i") },
    role: { $in: ["employee", "manager"] },
    $or: [{ isActive: true }, { isActive: { $exists: false } }],
  };

  if (branch && typeof branch === "string" && branch.trim()) {
    query.branch = { $regex: new RegExp(`^${branch.trim()}$`, "i") };
  }

  const users = await User.find(query)
    .select("_id name employeeId department branch designation")
    .lean();

  if (users.length === 0) {
    return { employeeMatchStatus: "NOT_FOUND", matchedEmployees: [], user: null };
  } else if (users.length > 1) {
    return {
      employeeMatchStatus: "AMBIGUOUS",
      matchedEmployees: users.map((u) => ({
        _id: u._id,
        name: u.name,
        employeeId: u.employeeId,
        department: u.department || "",
        branch: u.branch || "",
        designation: u.designation || "",
      })),
      user: null,
    };
  } else {
    return { employeeMatchStatus: "MATCHED", matchedEmployees: users, user: users[0] };
  }
};

/**
 * Searches and filters enterprise attendance records.
 * Supports date, date range, month/year, status, branch, and employeeName.
 *
 * @param {Object} params
 * @param {string} [params.date] - YYYY-MM-DD
 * @param {string} [params.startDate] - YYYY-MM-DD
 * @param {string} [params.endDate] - YYYY-MM-DD
 * @param {number|string} [params.month]
 * @param {number|string} [params.year]
 * @param {string} [params.employeeName]
 * @param {string} [params.status] - "present"|"absent"|"late"|"half-day"|"on-leave"
 * @param {string} [params.branch]
 * @param {number} [params.limit=25]
 * @returns {Promise<{ count: number, records: Array<Object>, employeeMatchStatus: string, matchedEmployees: Array<Object> }>}
 */
export const searchManagerAttendance = async ({
  date,
  startDate,
  endDate,
  month,
  year,
  employeeName,
  status,
  branch,
  limit = 25,
}) => {
  let userFilterIds = null;
  let employeeMatchStatus = "NONE";
  let matchedEmployees = [];

  // 1. Employee name resolution
  if (employeeName && typeof employeeName === "string" && employeeName.trim()) {
    const res = await resolveEmployeeDirectory(employeeName, branch);
    employeeMatchStatus = res.employeeMatchStatus;
    matchedEmployees = res.matchedEmployees;

    if (employeeMatchStatus === "NOT_FOUND" || employeeMatchStatus === "AMBIGUOUS") {
      return {
        count: 0,
        records: [],
        employeeMatchStatus,
        matchedEmployees,
      };
    }
    userFilterIds = [res.user._id];
  }

  // 2. Branch filtering (branch is on User, not Attendance)
  if (branch && typeof branch === "string" && branch.trim()) {
    const branchUsers = await User.find({
      branch: { $regex: new RegExp(`^${branch.trim()}$`, "i") },
      role: { $in: ["employee", "manager"] },
      $or: [{ isActive: true }, { isActive: { $exists: false } }],
    })
      .select("_id")
      .lean();
    const branchUserIds = branchUsers.map((u) => u._id);

    if (userFilterIds) {
      userFilterIds = userFilterIds.filter((id) =>
        branchUserIds.some((bId) => String(bId) === String(id))
      );
    } else {
      userFilterIds = branchUserIds;
    }
  }

  // 3. Construct Attendance query
  const query = {};
  if (userFilterIds) {
    query.employeeId = { $in: userFilterIds };
  }

  // Date filtering
  if (date) {
    query.date = String(date).trim();
  } else if (startDate && endDate) {
    query.date = { $gte: String(startDate).trim(), $lte: String(endDate).trim() };
  } else if (startDate) {
    query.date = { $gte: String(startDate).trim() };
  } else if (endDate) {
    query.date = { $lte: String(endDate).trim() };
  } else if (month && year) {
    const m = String(month).padStart(2, "0");
    query.date = { $regex: `^${year}-${m}` };
  } else if (month) {
    const currentYear = new Date().getFullYear();
    const m = String(month).padStart(2, "0");
    query.date = { $regex: `^${currentYear}-${m}` };
  }

  // Exact stored status filtering
  if (status) {
    const cleanStatus = String(status).trim().toLowerCase();
    const validStatuses = ["present", "absent", "late", "half-day", "on-leave"];
    if (validStatuses.includes(cleanStatus)) {
      query.status = cleanStatus;
    }
  }

  const records = await Attendance.find(query)
    .populate("employeeId", "name employeeId department designation branch")
    .sort({ date: -1, createdAt: -1 })
    .limit(Number(limit) || 25)
    .lean();

  const sanitized = records.map((r) => {
    const emp = r.employeeId;
    return {
      _id: r._id,
      date: r.date,
      status: r.status,
      checkInTime: r.checkInTime,
      checkOutTime: r.checkOutTime,
      workHours: r.workHours || 0,
      location: r.location || "",
      isManualOverride: r.isManualOverride || false,
      employee: emp
        ? {
            _id: emp._id,
            name: emp.name,
            employeeId: emp.employeeId,
            department: emp.department || "",
            designation: emp.designation || "",
            branch: emp.branch || "",
          }
        : null,
    };
  });

  return {
    count: sanitized.length,
    records: sanitized,
    employeeMatchStatus,
    matchedEmployees,
  };
};

/**
 * Retrieves detailed attendance information for a single employee on a given date.
 * Resolves employee name and distinguishes active checked-in session and no-record state.
 *
 * @param {Object} params
 * @param {string} params.employeeName
 * @param {string} [params.date] - defaults to today
 * @returns {Promise<Object>}
 */
export const getManagerAttendanceDetails = async ({ employeeName, date }) => {
  const targetDate = date ? String(date).trim() : getTodayDateStr();

  const res = await resolveEmployeeDirectory(employeeName);
  if (res.employeeMatchStatus === "NOT_FOUND") {
    return {
      found: false,
      employeeMatchStatus: "NOT_FOUND",
      message: `Employee "${employeeName}" was not found in the employee directory.`,
      matchedEmployees: [],
    };
  }
  if (res.employeeMatchStatus === "AMBIGUOUS") {
    return {
      found: false,
      employeeMatchStatus: "AMBIGUOUS",
      message: `Multiple employees matched "${employeeName}". Please clarify by specifying the department or employee ID.`,
      matchedEmployees: res.matchedEmployees,
    };
  }

  const emp = res.user;
  const record = await Attendance.findOne({
    employeeId: emp._id,
    date: targetDate,
  }).lean();

  if (!record) {
    return {
      found: false,
      employeeMatchStatus: "MATCHED",
      date: targetDate,
      employee: {
        _id: emp._id,
        name: emp.name,
        employeeId: emp.employeeId,
        department: emp.department || "",
        designation: emp.designation || "",
        branch: emp.branch || "",
      },
      record: null,
      message: `${emp.name} has no attendance record for ${targetDate}.`,
    };
  }

  const isActiveSession = Boolean(record.checkInTime && !record.checkOutTime);

  return {
    found: true,
    employeeMatchStatus: "MATCHED",
    date: targetDate,
    employee: {
      _id: emp._id,
      name: emp.name,
      employeeId: emp.employeeId,
      department: emp.department || "",
      designation: emp.designation || "",
      branch: emp.branch || "",
    },
    record: {
      _id: record._id,
      date: record.date,
      status: record.status,
      checkInTime: record.checkInTime,
      checkOutTime: record.checkOutTime,
      workHours: record.workHours || 0,
      location: record.location || "",
      isActiveSession,
      isManualOverride: record.isManualOverride || false,
    },
  };
};

/**
 * Computes a deterministic daily manager attendance summary for an active roster.
 * Accurately tracks independent and overlapping metrics without fabricating absence.
 *
 * @param {Object} params
 * @param {string} [params.date] - defaults to today
 * @param {string} [params.branch]
 * @returns {Promise<Object>}
 */
export const getManagerDailyAttendanceSummary = async ({ date, branch }) => {
  const targetDate = date ? String(date).trim() : getTodayDateStr();

  const userQuery = {
    role: { $in: ["employee", "manager"] },
    $or: [{ isActive: true }, { isActive: { $exists: false } }],
  };
  if (branch && typeof branch === "string" && branch.trim()) {
    userQuery.branch = { $regex: new RegExp(`^${branch.trim()}$`, "i") };
  }

  const roster = await User.find(userQuery)
    .select("_id name employeeId department branch")
    .lean();
  const rosterIds = roster.map((u) => u._id);

  if (rosterIds.length === 0) {
    return {
      date: targetDate,
      branch: branch || "All Branches",
      totalEmployees: 0,
      recordsFound: 0,
      checkedIn: 0,
      checkedOut: 0,
      currentlyCheckedIn: 0,
      late: 0,
      halfDay: 0,
      onLeave: 0,
      markedAbsent: 0,
      noRecord: 0,
    };
  }

  const records = await Attendance.find({
    employeeId: { $in: rosterIds },
    date: targetDate,
  }).lean();

  const recordMap = new Map(records.map((r) => [String(r.employeeId?._id || r.employeeId), r]));

  let checkedIn = 0;
  let checkedOut = 0;
  let currentlyCheckedIn = 0;
  let late = 0;
  let halfDay = 0;
  let onLeave = 0;
  let markedAbsent = 0;
  let noRecord = 0;

  for (const emp of roster) {
    const rec = recordMap.get(String(emp._id));
    if (!rec) {
      noRecord++;
      continue;
    }

    if (rec.checkInTime) {
      checkedIn++;
      if (rec.checkOutTime) {
        checkedOut++;
      } else {
        currentlyCheckedIn++;
      }
    }

    if (rec.status === "late") late++;
    if (rec.status === "half-day") halfDay++;
    if (rec.status === "on-leave") onLeave++;
    if (rec.status === "absent") markedAbsent++;
  }

  return {
    date: targetDate,
    branch: branch || "All Branches",
    totalEmployees: roster.length,
    recordsFound: records.length,
    checkedIn,
    checkedOut,
    currentlyCheckedIn,
    late,
    halfDay,
    onLeave,
    markedAbsent,
    noRecord,
  };
};

/**
 * Computes monthly attendance statistics for a single employee or team.
 * Uses explicit denominators (workedDays where checkInTime exists).
 *
 * @param {Object} params
 * @param {number|string} [params.month]
 * @param {number|string} [params.year]
 * @param {string} [params.branch]
 * @param {string} [params.employeeName]
 * @returns {Promise<Object>}
 */
export const getManagerMonthlyAttendanceSummary = async ({
  month,
  year,
  branch,
  employeeName,
}) => {
  const now = new Date();
  const targetMonth = Number(month || now.getMonth() + 1);
  const targetYear = Number(year || now.getFullYear());

  // Individual employee monthly summary
  if (employeeName && typeof employeeName === "string" && employeeName.trim()) {
    const res = await resolveEmployeeDirectory(employeeName, branch);
    if (res.employeeMatchStatus === "NOT_FOUND") {
      return {
        scope: "INDIVIDUAL",
        month: targetMonth,
        year: targetYear,
        employeeMatchStatus: "NOT_FOUND",
        message: `Employee "${employeeName}" was not found in the directory.`,
        matchedEmployees: [],
      };
    }
    if (res.employeeMatchStatus === "AMBIGUOUS") {
      return {
        scope: "INDIVIDUAL",
        month: targetMonth,
        year: targetYear,
        employeeMatchStatus: "AMBIGUOUS",
        message: `Multiple employees matched "${employeeName}". Please clarify.`,
        matchedEmployees: res.matchedEmployees,
      };
    }

    const emp = res.user;
    const summary = await getMonthlySummary({
      userId: emp._id,
      month: targetMonth,
      year: targetYear,
    });

    const workedDays = summary.records.filter((r) => r.checkInTime).length;

    return {
      scope: "INDIVIDUAL",
      employeeMatchStatus: "MATCHED",
      employee: {
        _id: emp._id,
        name: emp.name,
        employeeId: emp.employeeId,
        department: emp.department || "",
        branch: emp.branch || "",
        designation: emp.designation || "",
      },
      month: targetMonth,
      year: targetYear,
      present: summary.present,
      absent: summary.absent,
      late: summary.late,
      halfDay: summary.halfDay,
      onLeave: summary.onLeave,
      totalWorkHours: summary.totalWorkHours,
      avgWorkHours: summary.avgWorkHours,
      workedDays,
      workHoursDenominator: "workedDays (sessions with checkInTime)",
      totalRecords: summary.records.length,
    };
  }

  // Team-wide monthly summary
  const userQuery = {
    role: { $in: ["employee", "manager"] },
    $or: [{ isActive: true }, { isActive: { $exists: false } }],
  };
  if (branch && typeof branch === "string" && branch.trim()) {
    userQuery.branch = { $regex: new RegExp(`^${branch.trim()}$`, "i") };
  }

  const roster = await User.find(userQuery).select("_id").lean();
  const rosterIds = roster.map((u) => u._id);

  const m = String(targetMonth).padStart(2, "0");
  const records = await Attendance.find({
    employeeId: { $in: rosterIds },
    date: { $regex: `^${targetYear}-${m}` },
  }).lean();

  let totalWorkHours = 0;
  let totalWorkedSessions = 0;
  let totalLate = 0;
  let totalHalfDay = 0;
  let totalOnLeave = 0;
  let totalMarkedAbsent = 0;
  const uniqueAttendees = new Set();

  for (const r of records) {
    totalWorkHours += r.workHours || 0;
    if (r.checkInTime) {
      totalWorkedSessions++;
      uniqueAttendees.add(String(r.employeeId?._id || r.employeeId));
    }
    if (r.status === "late") totalLate++;
    if (r.status === "half-day") totalHalfDay++;
    if (r.status === "on-leave") totalOnLeave++;
    if (r.status === "absent") totalMarkedAbsent++;
  }

  totalWorkHours = Math.round(totalWorkHours * 100) / 100;
  const avgWorkHoursPerSession =
    totalWorkedSessions > 0
      ? Math.round((totalWorkHours / totalWorkedSessions) * 100) / 100
      : 0;

  return {
    scope: "TEAM",
    month: targetMonth,
    year: targetYear,
    branch: branch || "All Branches",
    totalEmployeesInRoster: roster.length,
    uniqueEmployeesAttended: uniqueAttendees.size,
    totalWorkedSessions,
    totalWorkHours,
    avgWorkHoursPerSession,
    workHoursDenominator: "totalWorkedSessions (records with checkInTime)",
    totalLate,
    totalHalfDay,
    totalOnLeave,
    totalMarkedAbsent,
    totalRecords: records.length,
  };
};

/**
 * Identifies employees in the active roster who have not checked in for a target date.
 * Explicitly separates "No attendance record" from "On Leave" and "Marked Absent".
 * Never fabricates absence.
 *
 * @param {Object} params
 * @param {string} [params.date] - defaults to today
 * @param {string} [params.branch]
 * @returns {Promise<Object>}
 */
export const getManagerNotCheckedIn = async ({ date, branch }) => {
  const targetDate = date ? String(date).trim() : getTodayDateStr();

  const userQuery = {
    role: { $in: ["employee", "manager"] },
    $or: [{ isActive: true }, { isActive: { $exists: false } }],
  };
  if (branch && typeof branch === "string" && branch.trim()) {
    userQuery.branch = { $regex: new RegExp(`^${branch.trim()}$`, "i") };
  }

  const roster = await User.find(userQuery)
    .select("_id name employeeId department branch designation")
    .lean();
  const rosterIds = roster.map((u) => u._id);

  if (rosterIds.length === 0) {
    return {
      date: targetDate,
      branch: branch || "All Branches",
      totalRoster: 0,
      notCheckedInCount: 0,
      employees: [],
    };
  }

  const records = await Attendance.find({
    employeeId: { $in: rosterIds },
    date: targetDate,
  }).lean();

  const recordMap = new Map(records.map((r) => [String(r.employeeId?._id || r.employeeId), r]));

  const employees = [];
  for (const emp of roster) {
    const rec = recordMap.get(String(emp._id));
    if (rec && rec.checkInTime) {
      continue; // Employee has checked in!
    }

    let category = "noRecord";
    let statusLabel = "No attendance record";
    if (rec?.status === "on-leave") {
      category = "onLeave";
      statusLabel = "On Leave";
    } else if (rec?.status === "absent") {
      category = "markedAbsent";
      statusLabel = "Marked Absent";
    }

    employees.push({
      _id: emp._id,
      name: emp.name,
      employeeId: emp.employeeId,
      department: emp.department || "",
      branch: emp.branch || "",
      designation: emp.designation || "",
      category,
      statusLabel,
    });
  }

  return {
    date: targetDate,
    branch: branch || "All Branches",
    totalRoster: roster.length,
    notCheckedInCount: employees.length,
    employees,
  };
};
