import express from "express";
import protect from "../../middlewares/authHandler.js";
import fyScope, { blockIfClosed } from "../../middlewares/fyScope.js";
import * as ctrl from "./receiptPayment.controller.js";

const router = express.Router();

router.use(protect);
router.use(fyScope);

router.get("/", ctrl.listPayments);
router.get("/:id", ctrl.getPayment);
router.post("/", blockIfClosed, ctrl.createPayment);
router.delete("/:id", blockIfClosed, ctrl.deletePayment);

export default router;
