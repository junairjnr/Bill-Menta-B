import ApiError from "../utils/ApiError.js";

const superAdminGuard = (req, res, next) => {
  try {
    if (req.user?.role !== "super_admin") {
      throw new ApiError(403, "Forbidden - Super admin access required");
    }
    next();
  } catch (err) {
    next(err);
  }
};

export default superAdminGuard;
