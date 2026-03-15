import { Router } from "express";
import {
  confirmRoomCheckIn,
  createRoom,
  deleteRoom,
  editRoom,
  getActiveRoomBooking,
  getRoomAvailability,
  getRooms,
  getPublicRoomList,
  revealRoomSecretCode
} from "../controllers/room.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/role.middleware.js";

const router = Router();

router.post("/", protect, authorize("manager"), createRoom);
router.put("/:id", protect, authorize("manager"), editRoom);
router.delete("/:id", protect, authorize("manager"), deleteRoom);
router.get("/public", getPublicRoomList);
router.get("/", protect, getRooms);
router.get("/availability", protect, getRoomAvailability);
router.get("/active-booking", getActiveRoomBooking);
router.post("/reveal-secret", revealRoomSecretCode);
router.post("/check-in", confirmRoomCheckIn);

export default router;
