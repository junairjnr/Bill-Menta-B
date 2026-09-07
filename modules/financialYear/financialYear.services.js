import FinancialYear from "./financialYear.model.js";
import ApiError from "../../utils/ApiError.js";

// ── Generate label from start year ───────────────────────────
const generateLabel = (startYear) => {
  const endYear = startYear + 1;
  return `${startYear}-${String(endYear).slice(2)}`; // "2025-26"
};

// ── Determine current FY start year ──────────────────────────
// Indian FY: April 1 to March 31
// If current month >= April (3), FY started this year
// If current month < April, FY started last year
export const getCurrentFYStartYear = () => {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed (March = 2, April = 3)
  return month >= 3 ? now.getFullYear() : now.getFullYear() - 1;
};

// ── Create FY ─────────────────────────────────────────────────
export const createFinancialYear = async (companyId, startYear) => {
  const label = generateLabel(startYear);
  const startDate = new Date(`${startYear}-04-01`);
  const endDate = new Date(`${startYear + 1}-03-31`);

  // Check duplicate
  const exists = await FinancialYear.findOne({ companyId, label });
  if (exists) throw new ApiError(409, `Financial year ${label} already exists`);

  // Deactivate all existing FYs — new one becomes active
  await FinancialYear.updateMany({ companyId }, { isActive: false });

  return FinancialYear.create({
    companyId,
    label,
    startDate,
    endDate,
    isActive: true,
    isClosed: false,
  });
};

// ── Get all FYs for company ───────────────────────────────────
export const getAllFY = async (companyId) => {
  return FinancialYear.find({ companyId }).sort({ startDate: -1 });
};

// ── Get active FY ─────────────────────────────────────────────
export const getActiveFY = async (companyId) => {
  const fy = await FinancialYear.findOne({ companyId, isActive: true });
  if (!fy)
    throw new ApiError(404, "No active financial year. Please create one.");
  return fy;
};

// ── Switch active FY ──────────────────────────────────────────
export const switchFY = async (companyId, fyId) => {
  const fy = await FinancialYear.findOne({ _id: fyId, companyId });
  if (!fy) throw new ApiError(404, "Financial year not found");
  if (fy.isClosed)
    throw new ApiError(400, "Cannot switch to a closed financial year");

  // Deactivate all → activate selected
  await FinancialYear.updateMany({ companyId }, { isActive: false });
  fy.isActive = true;
  await fy.save();
  return fy;
};

// ── Close FY — permanent lock ─────────────────────────────────
export const closeFY = async (companyId, fyId) => {
  const fy = await FinancialYear.findOne({ _id: fyId, companyId });
  if (!fy) throw new ApiError(404, "Financial year not found");
  if (fy.isClosed) throw new ApiError(400, "Already closed");

  fy.isClosed = true;
  fy.isActive = false;
  await fy.save();

  // Auto-activate latest open FY if exists
  const latest = await FinancialYear.findOne({
    companyId,
    isClosed: false,
  }).sort({ startDate: -1 });
  if (latest) {
    latest.isActive = true;
    await latest.save();
  }

  return fy;
};

//Delete FY
export const deleteFY = async (companyId, fyId) => {
  const fy = await FinancialYear.findOneAndDelete({ _id: fyId, companyId });
  if (!fy) throw new ApiError(404, "Financial year not found");

  return fy;
};
