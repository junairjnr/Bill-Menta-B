

import express from "express";
import itemCategoryModel from "./itemCategory.model.js";
import protect from "../../../middlewares/authHandler.js";
import crudFactory from "../../../utils/crudFactory.js";

const router = express.Router();

// const ctrl = crudFactory(itemCategoryModel);

const ctrl = crudFactory(itemCategoryModel, {
  selectFields: "name description isActive createdAt",
  hasTextIndex: true,
});

router.use(protect);


router.get("/", ctrl.getAll);
router.get("/:id", ctrl.getOne);
router.post("/add", ctrl.create);
router.put("/:id", ctrl.update);
router.delete("/:id", ctrl.remove);

export default router;
