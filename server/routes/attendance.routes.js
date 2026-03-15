import { Router } from "express";
import {
  getEmployeeMonthSummary,
  getLiveBoardForDate,
  getMyAttendance,
  getMyMonthSummary,
  getReport,
  getToday,
  handleCheckIn,
  handleCheckOut,
  manualOverride,
  requestAttendanceCorrection,
  reviewAttendanceCorrection,
} from "../controllers/attendance.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/role.middleware.js";

const router = Router();

// ── Employee routes ──────────────────────────────────────────────────────────
router.post("/check-in", protect, handleCheckIn);
router.post("/check-out", protect, handleCheckOut);
router.get("/today", protect, getToday);
router.get("/my", protect, getMyAttendance);
router.get("/my/summary", protect, getMyMonthSummary);
router.post("/request-correction", protect, requestAttendanceCorrection);

// ── Manager routes ───────────────────────────────────────────────────────────
router.get("/", protect, authorize("manager"), getLiveBoardForDate);
router.get("/report", protect, authorize("manager"), getReport);
router.get(
  "/summary/:userId",
  protect,
  authorize("manager"),
  getEmployeeMonthSummary
);
router.put(
  "/override/:recordId",
  protect,
  authorize("manager"),
  manualOverride
);
router.put(
  "/request/:recordId",
  protect,
  authorize("manager"),
  reviewAttendanceCorrection
);

export default router;
