import express from "express";
import protect from "../../../middlewares/authHandler.js";
import crudFactory from "../../../utils/crudFactory.js";
import itemModel from "./item.model.js";
import asyncHandler from "../../../utils/asyncHandler.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import ApiError from "../../../utils/ApiError.js";
import { assertUniqueItemName, normalizeItemRates } from "./item.service.js";

const router = express.Router();

const ctrl = crudFactory(itemModel, {
  selectFields:
    "name code uomId categoryId hsnCode salesRate purchaseRate price taxPercent description isActive createdAt",
  hasTextIndex: true,
  populateOpts: [
    { path: "categoryId", select: "name" },
    { path: "uomId", select: "name shortCode" },
  ],
});

const create = asyncHandler(async (req, res) => {
  delete req.body.companyId;
  req.body.name = await assertUniqueItemName(req.companyId, req.body.name);

  try {
    const doc = await itemModel.create({
      ...normalizeItemRates(req.body),
      companyId: req.companyId,
    });
    res.status(201).json(new ApiResponse(201, doc, "Created successfully"));
  } catch (err) {
    if (err.code === 11000) {
      const field = err.keyPattern ? Object.keys(err.keyPattern).join(", ") : "field";
      throw new ApiError(
        409,
        `Duplicate product ${field}. A record with this value already exists.`
      );
    }
    throw err;
  }
});

const update = asyncHandler(async (req, res) => {
  delete req.body.companyId;

  if (req.body.name !== undefined) {
    req.body.name = await assertUniqueItemName(
      req.companyId,
      req.body.name,
      req.params.id
    );
  }

  try {
    const doc = await itemModel
      .findOneAndUpdate(
        { _id: req.params.id, companyId: req.companyId },
        { $set: normalizeItemRates(req.body) },
        { new: true, runValidators: true }
      )
      .select("name code uomId categoryId hsnCode salesRate purchaseRate price taxPercent description isActive createdAt")
      .populate("categoryId", "name")
      .populate("uomId", "name shortCode")
      .lean();

    if (!doc) throw new ApiError(404, "Record not found");
    res.json(new ApiResponse(200, doc, "Updated successfully"));
  } catch (err) {
    if (err.code === 11000) {
      const field = err.keyPattern ? Object.keys(err.keyPattern).join(", ") : "field";
      throw new ApiError(
        409,
        `Duplicate product ${field}. A record with this value already exists.`
      );
    }
    throw err;
  }
});

router.use(protect);

router.get(
  "/search",
  protect,
  asyncHandler(async (req, res) => {
    const { q = "" } = req.query;

    const filter = { companyId: req.companyId, isActive: true };
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { code: { $regex: q, $options: "i" } },
      ];
    }

    const data = await itemModel.find(filter)
      .select("name code hsnCode salesRate purchaseRate price taxPercent uomId")
      .populate("uomId", "name shortCode")
      .limit(10)
      .lean();

    res.json(new ApiResponse(200, data));
  })
);

router.get("/", ctrl.getAll);
router.get("/:id", ctrl.getOne);
router.post("/add", create);
router.put("/:id", update);
router.delete("/:id", ctrl.remove);

export default router;

// populateOpts: [
//   { path: "categoryId", select: "name" },
//   { path: "customerId", select: "name phone" },
//   { path: "createdBy",  select: "name email" },
// ]

//for multiple population, we can pass an array of options to the crudFactory.
// Each object in the array specifies the path to populate and the fields to select from the related document.
// This allows us to retrieve related data in a single query, improving efficiency and reducing the number of database calls.
