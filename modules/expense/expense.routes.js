import express from "express";
import protect from "../../middlewares/authHandler.js";
import fyScope, { blockIfClosed } from "../../middlewares/fyScope.js";
import * as ctrl from "./expense.controller.js";

const router = express.Router();

router.use(protect);
router.use(fyScope);

router.get("/", ctrl.listExpenses);
router.get("/:id", ctrl.getExpense);
router.post("/", blockIfClosed, ctrl.createExpense);
router.put("/:id", blockIfClosed, ctrl.updateExpense);
router.delete("/:id", blockIfClosed, ctrl.deleteExpense);

export default router;
