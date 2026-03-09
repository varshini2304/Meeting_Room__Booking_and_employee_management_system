import { Router } from "express";
import { getNotifications, markRead } from "../controllers/notification.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", protect, getNotifications);
router.put("/:id/read", protect, markRead);

export default router;

