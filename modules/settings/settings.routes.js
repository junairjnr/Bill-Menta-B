import express from "express";
import protect from "../../middlewares/authHandler.js";
import superAdminGuard from "../../middlewares/superAdminGuard.js";
import roleManagementGuard from "../../middlewares/roleManagementGuard.js";
import * as ctrl from "./settings.controller.js";

const router = express.Router();

router.use(protect);

router.get("/my-permissions", ctrl.getMyPermissions);

router.get("/roles", roleManagementGuard("view"), ctrl.listRoles);
router.post("/roles", roleManagementGuard("add"), ctrl.createRole);
router.put("/roles/:id", roleManagementGuard("edit"), ctrl.updateRole);
router.delete("/roles/:id", roleManagementGuard("delete"), ctrl.deleteRole);

router.use(superAdminGuard);
router.get("/permissions", ctrl.getRolePermissions);
router.put("/permissions/:role", ctrl.updateRolePermissions);
router.get("/company", ctrl.getCompanySettings);
router.put("/company", ctrl.updateCompanySettings);

export default router;
