import express from "express";
import ctrl from "./financialYear.controller.js";
import protect from "../../middlewares/authHandler.js";
// import { roleGuard } from "../../middleware/roleGuard.js";

const router = express.Router();
router.use(protect);

router.get("/", ctrl.getAll); // all FYs
router.get("/active", ctrl.getActive); // currently active FY
router.post("/", ctrl.create); // create new FY
router.patch("/:id/switch", ctrl.switchFY); // switch active
router.patch("/:id/close", ctrl.closeFY); // lock FY
router.delete("/:id", ctrl.deleteFY); // delete FY

export default router;
