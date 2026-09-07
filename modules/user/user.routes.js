import express from "express";
import protect from "../../middlewares/authHandler.js";
import userManagementGuard from "../../middlewares/userManagementGuard.js";
import * as ctrl from "./user.controller.js";

const router = express.Router();

router.use(protect);

router.get("/users", userManagementGuard("view"), ctrl.listUsers);
router.get("/users/:id", userManagementGuard("view"), ctrl.getUser);
router.post("/users", userManagementGuard("add"), ctrl.createUser);
router.put("/users/:id", userManagementGuard("edit"), ctrl.updateUser);
router.delete("/users/:id", userManagementGuard("delete"), ctrl.deactivateUser);

export default router;
