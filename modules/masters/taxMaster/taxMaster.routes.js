import TaxMaster from "./taxMaster.model.js";
import express from "express";
import protect from "../../../middlewares/authHandler.js";
import crudFactory from "../../../utils/crudFactory.js";

const router = express.Router();

const ctrl = crudFactory(TaxMaster, {
  selectFields: "name taxPercent isActive createdAt",
  hasTextIndex: true,
});

router.use(protect);

router.get("/", ctrl.getAll);
router.get("/:id", ctrl.getOne);
router.post("/add", ctrl.create);
router.put("/:id", ctrl.update);
router.delete("/:id", ctrl.remove);

export default router;
