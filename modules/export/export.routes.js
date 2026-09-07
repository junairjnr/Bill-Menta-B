import express from "express";
import protect from "../../middlewares/authHandler.js";
import fyScope from "../../middlewares/fyScope.js";
import ctrl from "./export.controller.js";

const router = express.Router();

router.use(protect);

router.get("/:reportType/columns", fyScope, ctrl.getColumns);
router.post("/:reportType", fyScope, ctrl.downloadExcel);

export default router;
