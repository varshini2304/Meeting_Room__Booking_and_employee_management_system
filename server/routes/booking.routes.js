import { Router } from "express";
import {
  cancelBooking,
  confirmOccupancy,
  confirmOccupancyWithToken,
  createBooking,
  getAllBookings,
  getBookingHistory,
  getCheckInDetails,
  getDayBookings,
  getMyUpcomingBookings
} from "../controllers/booking.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/role.middleware.js";

const router = Router();

router.get("/check-in/details", getCheckInDetails);
router.post("/check-in", confirmOccupancyWithToken);

router.post("/", protect, createBooking);
router.get("/", protect, authorize("manager"), getAllBookings);
router.get("/day", protect, getDayBookings);
router.get("/my", protect, getMyUpcomingBookings);
router.get("/history", protect, getBookingHistory);
router.delete("/:id", protect, cancelBooking);
router.put("/:id/confirm-occupancy", protect, confirmOccupancy);

export default router;
