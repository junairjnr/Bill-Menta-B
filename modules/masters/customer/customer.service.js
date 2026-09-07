import customerModel from "./customer.model.js";
import ApiError from "../../../utils/ApiError.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const assertUniqueCustomerName = async (companyId, name, excludeId) => {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) throw new ApiError(400, "Party name is required");

  const filter = {
    companyId,
    name: { $regex: new RegExp(`^${escapeRegex(trimmed)}$`, "i") },
  };

  if (excludeId) filter._id = { $ne: excludeId };

  const exists = await customerModel.findOne(filter).select("_id name").lean();
  if (exists) {
    throw new ApiError(409, `Party name "${trimmed}" already exists`);
  }

  return trimmed;
};
