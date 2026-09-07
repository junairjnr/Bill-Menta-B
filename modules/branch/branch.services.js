import Branch  from "./branch.model.js";
import ApiError from "../../utils/ApiError.js";

const createBranch = async (companyId, payload) => {
  // Only one HO per company
  if (payload.isHeadOffice) {
    const existing = await Branch.findOne({ companyId, isHeadOffice: true });
    if (existing) throw new ApiError(400, "Head office already exists");
  }
  return Branch.create({ ...payload, companyId });
};

const getAll = async (companyId) => {
  return Branch.find({ companyId, isActive: true }).sort({ isHeadOffice: -1, name: 1 });
};

const getOne = async (companyId, branchId) => {
  const branch = await Branch.findOne({ _id: branchId, companyId });
  if (!branch) throw new ApiError(404, "Branch not found");
  return branch;
};

const update = async (companyId, branchId, payload) => {
  delete payload.companyId;
  delete payload.isHeadOffice; // can't change HO status after creation
  const branch = await Branch.findOneAndUpdate(
    { _id: branchId, companyId },
    { $set: payload },
    { new: true, runValidators: true }
  );
  if (!branch) throw new ApiError(404, "Branch not found");
  return branch;
};

const deactivate = async (companyId, branchId) => {
  const branch = await Branch.findOne({ _id: branchId, companyId });
  if (!branch) throw new ApiError(404, "Branch not found");
  if (branch.isHeadOffice) throw new ApiError(400, "Cannot deactivate head office");
  branch.isActive = false;
  await branch.save();
  return branch;
};

const remove = async (companyId, branchId) => {
  const branch = await Branch.findOneAndDelete({ _id: branchId, companyId }).lean();
  if (!branch) throw new ApiError(404, "Branch not found");
  return branch;
};

export default { createBranch, getAll, getOne, update, deactivate, remove };