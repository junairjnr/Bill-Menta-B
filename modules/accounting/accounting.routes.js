import express from "express";
import ctrl from "./accounting.controller.js";
import protect from "../../middlewares/authHandler.js";
import fyScope, { blockIfClosed } from "../../middlewares/fyScope.js";

const router = express.Router();

router.use(protect);

router.get("/chart-of-accounts", fyScope, ctrl.listAccounts);
router.post("/chart-of-accounts", fyScope, ctrl.createAccount);
router.post("/chart-of-accounts/seed", fyScope, ctrl.seedCOA);
router.put("/chart-of-accounts/:id", fyScope, ctrl.updateAccount);

router.get("/journals", fyScope, ctrl.listJournals);
router.post("/journals", fyScope, blockIfClosed, ctrl.createJournal);
router.get("/journals/:id", fyScope, ctrl.getJournal);
router.post("/journals/:id/reverse", fyScope, blockIfClosed, ctrl.reverseJournal);

router.get("/reports/trial-balance", fyScope, ctrl.trialBalance);
router.get("/reports/profit-loss", fyScope, ctrl.profitAndLoss);
router.get("/reports/balance-sheet", fyScope, ctrl.balanceSheet);
router.get("/reports/sub-ledger", fyScope, ctrl.subLedger);
router.get("/reports/customer-balances", fyScope, ctrl.customerBalances);
router.get("/reports/vendor-balances", fyScope, ctrl.vendorBalances);
router.get("/reports/general-ledger/:accountCode", fyScope, ctrl.generalLedger);
router.get("/customers/:id/balance", fyScope, ctrl.customerBalance);
router.get("/vendors/:id/balance", fyScope, ctrl.vendorBalance);

export default router;
