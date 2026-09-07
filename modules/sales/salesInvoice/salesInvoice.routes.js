import express from "express";
import ctrl from "./salesInvoice.controller.js";
import protect from "../../../middlewares/authHandler.js";
import fyScope, { blockIfClosed } from "../../../middlewares/fyScope.js";
// import { roleGuard } from "../../middleware/roleGuard.js";

const router = express.Router();

router.use(protect);
router.use(fyScope);

router.get("/", ctrl.getAll);
router.get("/:id", ctrl.getOne);
router.post("/add", blockIfClosed, ctrl.create);

export default router;
