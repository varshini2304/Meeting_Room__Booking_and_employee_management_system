import { Router } from "express";
import { createUserByManager, listUsers } from "../controllers/user.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/role.middleware.js";

const router = Router();

router.post("/", protect, authorize("manager"), createUserByManager);
router.get("/", protect, authorize("manager"), listUsers);

export default router;
