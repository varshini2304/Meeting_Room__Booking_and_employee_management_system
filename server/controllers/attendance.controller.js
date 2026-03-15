import {
  checkIn,
  checkOut,
  getAllForDate,
  getDateRangeReport,
  getMyHistory,
  getMonthlySummary,
  getTodayDateStr,
  getTodayRecord,
  overrideAttendance,
  requestCorrection,
  reviewCorrection,
} from "../services/attendance.service.js";
import { Attendance } from "../models/attendance.model.js";

// ─── Employee endpoints ───────────────────────────────────────────────────────

export const handleCheckIn = async (req, res, next) => {
  try {
    const record = await checkIn({
      userId: req.user._id,
      location: req.body.location || "",
    });
    res.status(200).json(record);
  } catch (error) {
    next(error);
  }
};

export const handleCheckOut = async (req, res, next) => {
  try {
    const record = await checkOut({ userId: req.user._id });
    res.status(200).json(record);
  } catch (error) {
    next(error);
  }
};

export const getToday = async (req, res, next) => {
  try {
    const record = await getTodayRecord(req.user._id);
    res.json(record || { status: "absent", date: getTodayDateStr() });
  } catch (error) {
    next(error);
  }
};

export const getMyAttendance = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const now = new Date();
    const records = await getMyHistory({
      userId: req.user._id,
      month: month || now.getMonth() + 1,
      year: year || now.getFullYear(),
    });
    res.json(records);
  } catch (error) {
    next(error);
  }
};

export const getMyMonthSummary = async (req, res, next) => {
  try {
    const now = new Date();
    const month = Number(req.query.month || now.getMonth() + 1);
    const year = Number(req.query.year || now.getFullYear());
    const summary = await getMonthlySummary({ userId: req.user._id, month, year });
    res.json(summary);
  } catch (error) {
    next(error);
  }
};

export const requestAttendanceCorrection = async (req, res, next) => {
  try {
    const { date, checkInTime, checkOutTime, reason } = req.body;
    const record = await requestCorrection({
      userId: req.user._id,
      date,
      requestedCheckInTime: checkInTime,
      requestedCheckOutTime: checkOutTime,
      reason,
    });
    res.status(200).json(record);
  } catch (error) {
    next(error);
  }
};

// ─── Manager endpoints ────────────────────────────────────────────────────────

export const getLiveBoardForDate = async (req, res, next) => {
  try {
    const date = req.query.date || getTodayDateStr();
    const data = await getAllForDate(date);
    res.json(data);
  } catch (error) {
    next(error);
  }
};

export const getReport = async (req, res, next) => {
  try {
    const { from, to, employeeId } = req.query;
    if (!from || !to) {
      return res.status(400).json({ message: "from and to dates are required" });
    }
    const data = await getDateRangeReport({ from, to, employeeId });
    return res.json(data);
  } catch (error) {
    return next(error);
  }
};

export const getEmployeeMonthSummary = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const now = new Date();
    const month = Number(req.query.month || now.getMonth() + 1);
    const year = Number(req.query.year || now.getFullYear());
    const summary = await getMonthlySummary({ userId, month, year });
    res.json(summary);
  } catch (error) {
    next(error);
  }
};

export const manualOverride = async (req, res, next) => {
  try {
    const { recordId } = req.params;
    const { status, notes, checkInTime, checkOutTime, employeeId, date } = req.body;

    let id = recordId;

    // If no recordId but employeeId + date given, upsert first
    if (recordId === "new" && employeeId && date) {
      const rec = await Attendance.findOneAndUpdate(
        { employeeId, date },
        { $setOnInsert: { employeeId, date, status: "absent" } },
        { upsert: true, new: true }
      );
      id = rec._id;
    }

    const record = await overrideAttendance({
      recordId: id,
      managerId: req.user._id,
      status,
      notes,
      checkInTime,
      checkOutTime,
    });
    res.json(record);
  } catch (error) {
    next(error);
  }
};

export const reviewAttendanceCorrection = async (req, res, next) => {
  try {
    const { recordId } = req.params;
    const { action, notes } = req.body;
    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ message: "action must be approve or reject" });
    }
    const record = await reviewCorrection({
      recordId,
      managerId: req.user._id,
      action,
      notes,
    });
    res.json(record);
  } catch (error) {
    next(error);
  }
};
