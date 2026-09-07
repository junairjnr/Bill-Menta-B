import express from "express";
import authController from "./auth.controller.js";
import { authRateLimiter } from "../../middlewares/rateLimiter.js";

const router = express.Router();

router.post("/register", authRateLimiter, authController.register);
router.post("/login", authRateLimiter, authController.login);

export default router;