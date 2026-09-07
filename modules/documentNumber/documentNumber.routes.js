import express from "express";
import ctrl from "./documentNumber.controller.js";
import protect from "../../middlewares/authHandler.js";
import fyScope from "../../middlewares/fyScope.js";

const router = express.Router();

router.use(protect);
router.use(fyScope);

router.get("/next", ctrl.previewNextNumber);

export default router;
