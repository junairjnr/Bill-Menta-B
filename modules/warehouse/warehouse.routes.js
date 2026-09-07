import express from "express";
import ctrl from "./warehouse.controller.js";
import  protect  from "../../middlewares/authHandler.js";
import fyScope from "../../middlewares/fyScope.js";

const router = express.Router();
router.use(protect);

// Warehouse CRUD
router.get("/", ctrl.getAll);
router.get("/:id", ctrl.getOne);
router.post("/add", ctrl.create);
router.put("/:id", ctrl.update);
// router.delete("/:id", ctrl.deactivate);
router.delete("/:id", ctrl.deleteWarehouse);

// Stock routes — need FY scope
router.get("/:id/stock", fyScope, ctrl.getStock);
router.get("/:id/ledger", fyScope, ctrl.getLedger);

export default router;
