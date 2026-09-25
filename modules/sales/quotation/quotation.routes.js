import express from "express";
import ctrl from "./quotation.controller.js";
import protect from "../../../middlewares/authHandler.js";
import fyScope, { blockIfClosed } from "../../../middlewares/fyScope.js";

const router = express.Router();

router.use(protect);
router.use(fyScope);

router.get("/", ctrl.getAll);
router.get("/:id", ctrl.getOne);
router.post("/add", blockIfClosed, ctrl.create);
router.post("/:id/convert", blockIfClosed, ctrl.markConverted);

export default router;
