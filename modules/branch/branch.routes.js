import express from "express";
import ctrl from "./branch.controller.js";
import  protect  from "../../middlewares/authHandler.js";
// import { roleGuard } from "../../middlewares/roleGuard.js";

const router = express.Router();

router.use(protect);

router.get("/", ctrl.getAll);
router.get("/:id", ctrl.getOne);
router.post("/", ctrl.create);
router.put("/:id", ctrl.update);
// router.delete("/:id",                ctrl.deactivate);
router.delete("/:id", ctrl.remove);

export default router;
