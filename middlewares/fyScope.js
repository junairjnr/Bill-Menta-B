import FinancialYear from "../modules/financialYear/financialYear.model.js";
import ApiError      from "../utils/ApiError.js";

// Attach fyId to req from header or query
const fyScope = async (req, res, next) => {
  try {
    // Get fyId from header or query param
    const fyId = req.headers["x-fy-id"] || req.query.fyId;

    if (fyId) {
      // Validate it belongs to this company
      const fy = await FinancialYear.findOne({
        _id:       fyId,
        companyId: req.companyId,
      });
      if (!fy) throw new ApiError(400, "Invalid financial year");

      req.fyId     = fy._id;
      req.fy       = fy;
      req.fyClosed = fy.isClosed;

    } else {
      // No fyId sent — use active FY automatically
      const fy = await FinancialYear.findOne({
        companyId: req.companyId,
        isActive:  true,
      });
      if (!fy) throw new ApiError(400, "No active financial year found");

      req.fyId     = fy._id;
      req.fy       = fy;
      req.fyClosed = fy.isClosed;
    }

    next();
  } catch (err) {
    next(err);
  }
};

// Block writes on closed FY
export const blockIfClosed = (req, res, next) => {
  if (req.fyClosed) {
    throw new ApiError(403, "This financial year is closed. No changes allowed.");
  }
  next();
};

export default fyScope;