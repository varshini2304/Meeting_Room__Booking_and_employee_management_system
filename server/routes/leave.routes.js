import { Router } from "express";
import {
  adjustBalanceHandler,
  apply,
  approveLeaveHandler,
  cancelLeaveHandler,
  getAllLeavesHandler,
  getEmployeeBalanceHandler,
  getMyBalanceHandler,
  getMyLeavesHandler,
  getTeamCalendarHandler,
  initBalancesHandler,
  rejectLeaveHandler,
} from "../controllers/leave.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/role.middleware.js";

const router = Router();

// ── Employee routes ──────────────────────────────────────────────────────────
router.post  ("/",                protect,                          apply);
router.get   ("/my",              protect,                          getMyLeavesHandler);
router.get   ("/balance",         protect,                          getMyBalanceHandler);
router.delete("/:id",             protect,                          cancelLeaveHandler);

// ── Shared routes ────────────────────────────────────────────────────────────
router.get   ("/calendar",        protect,                          getTeamCalendarHandler);

// ── Manager routes ───────────────────────────────────────────────────────────
router.get   ("/",                protect, authorize("manager"),    getAllLeavesHandler);
router.put   ("/:id/approve",     protect, authorize("manager"),    approveLeaveHandler);
router.put   ("/:id/reject",      protect, authorize("manager"),    rejectLeaveHandler);
router.get   ("/balance/:userId", protect, authorize("manager"),    getEmployeeBalanceHandler);
router.post  ("/balance/adjust",  protect, authorize("manager"),    adjustBalanceHandler);
router.post  ("/balance/init",    protect, authorize("manager"),    initBalancesHandler);

export default router;
