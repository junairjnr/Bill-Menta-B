import express from "express";
import ctrl from "./report.controller.js";
import protect from "../../middlewares/authHandler.js";
import fyScope from "../../middlewares/fyScope.js";

const router = express.Router();

router.use(protect);
router.use(fyScope);

router.get("/dashboard", ctrl.dashboardReport);
router.get("/stock", ctrl.stockReport);
router.get("/purchase", ctrl.purchaseReport);
router.get("/sales", ctrl.salesReport);
router.get("/ledger", ctrl.ledgerReport);
router.get("/shop",             ctrl.shopReport);         // ← replaces /ledger
router.get("/purchase-history", ctrl.purchaseHistory);
router.get("/sales-history",    ctrl.salesHistory);
router.get("/sales-return-history", ctrl.salesReturnHistory);
router.get("/purchase-return-history", ctrl.purchaseReturnHistory);
router.get("/expense", ctrl.expenseReport);

export default router;
