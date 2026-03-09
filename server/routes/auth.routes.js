import { Router } from "express";
import { login, logout, profile, register } from "../controllers/auth.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/register", register);
router.post("/signup", register);
router.post("/login", login);
router.post("/logout", protect, logout);
router.get("/profile", protect, profile);
router.get("/me", protect, profile);

export default router;
