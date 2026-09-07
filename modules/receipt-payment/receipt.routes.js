import express from "express";
import protect from "../../middlewares/authHandler.js";
import fyScope, { blockIfClosed } from "../../middlewares/fyScope.js";
import * as ctrl from "./receiptPayment.controller.js";

const router = express.Router();

router.use(protect);
router.use(fyScope);

router.get("/", ctrl.listReceipts);
router.get("/:id", ctrl.getReceipt);
router.post("/", blockIfClosed, ctrl.createReceipt);
router.delete("/:id", blockIfClosed, ctrl.deleteReceipt);

export default router;
