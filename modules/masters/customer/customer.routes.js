import express from "express";
import protect from "../../../middlewares/authHandler.js";
import crudFactory from "../../../utils/crudFactory.js";
import customerModel from "./customer.model.js";
import asyncHandler from "../../../utils/asyncHandler.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import ApiError from "../../../utils/ApiError.js";
import { assertUniqueCustomerName } from "./customer.service.js";

const router = express.Router();

const selectFields =
  "name email phone gstin customerType creditLimit address isActive createdAt type";

const ctrl = crudFactory(customerModel, {
  selectFields,
  hasTextIndex: true,
});

const create = asyncHandler(async (req, res) => {
  delete req.body.companyId;
  req.body.name = await assertUniqueCustomerName(req.companyId, req.body.name);

  try {
    const doc = await customerModel.create({
      ...req.body,
      companyId: req.companyId,
    });
    res.status(201).json(new ApiResponse(201, doc, "Created successfully"));
  } catch (err) {
    if (err.code === 11000) {
      throw new ApiError(409, `Party name "${req.body.name}" already exists`);
    }
    throw err;
  }
});

const update = asyncHandler(async (req, res) => {
  delete req.body.companyId;

  if (req.body.name !== undefined) {
    req.body.name = await assertUniqueCustomerName(
      req.companyId,
      req.body.name,
      req.params.id
    );
  }

  try {
    const doc = await customerModel
      .findOneAndUpdate(
        { _id: req.params.id, companyId: req.companyId },
        { $set: req.body },
        { new: true, runValidators: true }
      )
      .select(selectFields)
      .lean();

    if (!doc) throw new ApiError(404, "Record not found");
    res.json(new ApiResponse(200, doc, "Updated successfully"));
  } catch (err) {
    if (err.code === 11000) {
      throw new ApiError(409, `Party name "${req.body.name}" already exists`);
    }
    throw err;
  }
});

router.get(
  "/search",
  protect,
  asyncHandler(async (req, res) => {
    const { q = "", type, customerType } = req.query;

    const filter = { companyId: req.companyId, isActive: true };
    if (type) filter.type = type;
    if (customerType) filter.customerType = customerType;
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { phone: { $regex: q, $options: "i" } },
      ];
    }

    const data = await customerModel
      .find(filter)
      .select("name phone type customerType gstin address")
      .limit(10)
      .lean();

    res.json(new ApiResponse(200, data));
  })
);

router.use(protect);
router.get("/", ctrl.getAll);
router.get("/:id", ctrl.getOne);
router.post("/add", create);
router.put("/:id", update);
router.delete("/:id", ctrl.remove);

export default router;
