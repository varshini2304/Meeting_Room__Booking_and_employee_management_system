import {
  adjustBalance,
  applyLeave,
  approveLeave,
  cancelLeave,
  getAllLeaves,
  getMyBalance,
  getMyLeaves,
  getTeamCalendar,
  initYearBalances,
  rejectLeave,
} from "../services/leave.service.js";

// ─── Employee ─────────────────────────────────────────────────────────────────

export const apply = async (req, res, next) => {
  try {
    const { leaveType, startDate, endDate, reason, isHalfDay, halfDayPeriod } = req.body;
    const leave = await applyLeave({
      employeeId: req.user._id,
      leaveType,
      startDate,
      endDate,
      reason,
      isHalfDay: Boolean(isHalfDay),
      halfDayPeriod: halfDayPeriod || "",
    });
    res.status(201).json(leave);
  } catch (error) {
    next(error);
  }
};

export const getMyLeavesHandler = async (req, res, next) => {
  try {
    const { year, status } = req.query;
    const leaves = await getMyLeaves(req.user._id, { year, status });
    res.json(leaves);
  } catch (error) {
    next(error);
  }
};

export const getMyBalanceHandler = async (req, res, next) => {
  try {
    const year = Number(req.query.year || new Date().getFullYear());
    const balance = await getMyBalance(req.user._id, year);
    res.json(balance);
  } catch (error) {
    next(error);
  }
};

export const cancelLeaveHandler = async (req, res, next) => {
  try {
    const leave = await cancelLeave(req.params.id, req.user._id);
    res.json(leave);
  } catch (error) {
    next(error);
  }
};

// ─── Manager ──────────────────────────────────────────────────────────────────

export const getAllLeavesHandler = async (req, res, next) => {
  try {
    const { status, from, to, employeeId } = req.query;
    const leaves = await getAllLeaves({ status, from, to, employeeId });
    res.json(leaves);
  } catch (error) {
    next(error);
  }
};

export const approveLeaveHandler = async (req, res, next) => {
  try {
    const leave = await approveLeave(req.params.id, req.user._id, req.body.notes || "");
    res.json(leave);
  } catch (error) {
    next(error);
  }
};

export const rejectLeaveHandler = async (req, res, next) => {
  try {
    const leave = await rejectLeave(req.params.id, req.user._id, req.body.notes || "");
    res.json(leave);
  } catch (error) {
    next(error);
  }
};

export const getTeamCalendarHandler = async (req, res, next) => {
  try {
    const now = new Date();
    const month = Number(req.query.month || now.getMonth() + 1);
    const year  = Number(req.query.year  || now.getFullYear());
    const data  = await getTeamCalendar(month, year);
    res.json(data);
  } catch (error) {
    next(error);
  }
};

export const adjustBalanceHandler = async (req, res, next) => {
  try {
    const { employeeId, year, updates } = req.body;
    if (!employeeId || !year || !updates) {
      return res.status(400).json({ message: "employeeId, year and updates are required" });
    }
    const balance = await adjustBalance(employeeId, Number(year), updates);
    return res.json(balance);
  } catch (error) {
    return next(error);
  }
};

export const initBalancesHandler = async (req, res, next) => {
  try {
    const year = Number(req.body.year || new Date().getFullYear());
    const count = await initYearBalances(year);
    res.json({ message: `Initialized balances for ${count} employees`, year });
  } catch (error) {
    next(error);
  }
};

export const getEmployeeBalanceHandler = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const year = Number(req.query.year || new Date().getFullYear());
    const balance = await getMyBalance(userId, year);
    res.json(balance);
  } catch (error) {
    next(error);
  }
};
