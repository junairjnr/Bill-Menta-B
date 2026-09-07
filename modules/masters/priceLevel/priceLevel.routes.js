import PriceLevel from "./priceLevel.model.js";
// import { roleGuard } from "../../../middleware/roleGuard.js";

import express from "express";
import protect from "../../../middlewares/authHandler.js";
import crudFactory from "../../../utils/crudFactory.js";

const router = express.Router();

const ctrl = crudFactory(PriceLevel, {
  selectFields: "name taxPercent isActive createdAt",
  hasTextIndex: true,
});

router.use(protect);

router.get("/", ctrl.getAll);
router.get("/:id", ctrl.getOne);
router.post("/add", ctrl.create);
router.put("/:id", ctrl.update);
router.delete("/:id", ctrl.remove);

// router.patch("/:id/restore", ctrl.restore);
// router.get("/", ctrl.getAll);
// router.get("/:id", ctrl.getOne);
// router.post("/", roleGuard("admin", "manager"), ctrl.create);
// router.put("/:id", roleGuard("admin", "manager"), ctrl.update);
// router.delete("/:id", roleGuard("admin"), ctrl.remove);
// router.patch("/:id/restore", roleGuard("admin"), ctrl.restore);

export default router;
