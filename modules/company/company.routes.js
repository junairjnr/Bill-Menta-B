import express from "express";
import ctrl from "./company.controller.js";
import protect from "../../middlewares/authHandler.js";
import superAdminGuard from "../../middlewares/superAdminGuard.js";

const router = express.Router();

router.use(protect);

router.get("/all", superAdminGuard, ctrl.getAllCompanies);
router.get("/:id", ctrl.getCompanyDetails);
router.put("/:id", ctrl.updateCompanyDetails);

export default router;
