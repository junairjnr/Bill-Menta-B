import ApiError from "../utils/ApiError.js";

const roleGuard =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user.role))
      throw new ApiError(403, "Forbidden - Insufficient permissions");
    next();
  };

export default roleGuard;
