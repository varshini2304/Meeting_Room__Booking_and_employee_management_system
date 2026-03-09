import { Router } from "express";
import { createRoom, editRoom, getRoomAvailability, getRooms } from "../controllers/room.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/role.middleware.js";

const router = Router();

router.post("/", protect, authorize("manager"), createRoom);
router.put("/:id", protect, authorize("manager"), editRoom);
router.get("/", protect, getRooms);
router.get("/availability", protect, getRoomAvailability);

export default router;

