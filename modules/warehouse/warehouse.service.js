import mongoose from "mongoose";
import Warehouse from "./warehouse.model.js";
import ApiError from "../../utils/ApiError.js";

export const createWarehouse = async (companyId, branchId, payload) => {
  // Only one default per branch
  if (payload.isDefault) {
    await Warehouse.updateMany({ companyId, branchId }, { isDefault: false });
  }
  return Warehouse.create({ ...payload, companyId, branchId });
};

// export const getAll = async (companyId, branchId) => {
//   const filter = { companyId, isActive: true };
//   if (branchId) filter.branchId = branchId;
//   return Warehouse.find(filter)
//     .populate("branchId", "name code")
//     .sort({ isDefault: -1, name: 1 })
//     .lean();
// };
// service
export const getAll = async (companyId, queryParams = {}) => {
  const { page = 1, limit = 20, search, branchId } = queryParams;

  console.log("Fetching warehouses with params:", { companyId, queryParams, branchId });
  const filter = {
    companyId,
    isActive: true,
  };
  if (!branchId)
    console.log("No branchId provided, fetching warehouses for entire company");
  if (branchId) filter.branchId = branchId;

  if (search) {
    filter.name = { $regex: search, $options: "i" };
  }

  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    Warehouse.find(filter)
      .populate("branchId", "name code")
      .sort({ isDefault: -1, name: 1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Warehouse.countDocuments(filter),
  ]);
  console.log("Total warehouses:", total, data);

  return {
    data,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / limit),
    hasNext: page < Math.ceil(total / limit),
  };
};

export const getOne = async (companyId, warehouseId) => {
  const wh = await Warehouse.findOne({ _id: warehouseId, companyId })
    .populate("branchId", "name code")
    .lean();
  if (!wh) throw new ApiError(404, "Warehouse not found");
  return wh;
};

export const updateWarehouse = async (companyId, warehouseId, payload) => {
  delete payload.companyId;
  delete payload.branchId;

  if (payload.isDefault) {
    const wh = await Warehouse.findOne({ _id: warehouseId, companyId });
    if (wh)
      await Warehouse.updateMany(
        { companyId, branchId: wh.branchId },
        { isDefault: false }
      );
  }

  const wh = await Warehouse.findOneAndUpdate(
    { _id: warehouseId, companyId },
    { $set: payload },
    { new: true, runValidators: true }
  ).lean();

  if (!wh) throw new ApiError(404, "Warehouse not found");
  return wh;
};

export const deactivateWarehouse = async (companyId, warehouseId) => {
  const wh = await Warehouse.findOne({ _id: warehouseId, companyId });
  if (!wh) throw new ApiError(404, "Warehouse not found");
  if (wh.isDefault)
    throw new ApiError(400, "Cannot deactivate default warehouse");

  wh.isActive = false;
  await wh.save();
  return wh;
};

export const deleteWarehouse = async (companyId, warehouseId) => {
  const wh = await Warehouse.findOneAndDelete({ _id: warehouseId, companyId });
  if (!wh) throw new ApiError(404, "Warehouse not found");
  return wh;
};
