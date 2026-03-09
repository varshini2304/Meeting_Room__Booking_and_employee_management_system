import { Router } from "express";
import {
  cancelBooking,
  confirmOccupancy,
  createBooking,
  getAllBookings,
  getBookingHistory,
  getMyUpcomingBookings
} from "../controllers/booking.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/role.middleware.js";

const router = Router();

router.post("/", protect, createBooking);
router.get("/", protect, authorize("manager"), getAllBookings);
router.get("/my", protect, getMyUpcomingBookings);
router.get("/history", protect, getBookingHistory);
router.delete("/:id", protect, cancelBooking);
router.put("/:id/confirm-occupancy", protect, confirmOccupancy);

export default router;
