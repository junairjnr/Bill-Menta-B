import express from "express";
import crudFactory from "../../../utils/crudFactory.js";
import protect from "../../../middlewares/authHandler.js";
import bankAccount from "./bank.model.js";

const router = express.Router();

const ctrl = crudFactory(bankAccount, {
  selectFields:
    "accountName bankName accountNumber ifscCode branch accountType upiId isDefault isActive createdAt",
  hasTextIndex: false,
});

router.use(protect);
router.get("/", ctrl.getAll);
router.get("/:id", ctrl.getOne);
router.post("/", ctrl.create);
router.put("/:id", ctrl.update);
router.delete("/:id", ctrl.remove);
router.patch("/:id/restore", ctrl.restore);

export default router;
