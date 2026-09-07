import ApiError from "../utils/ApiError.js";
import { canAction, getEffectivePermissions } from "../modules/settings/settings.service.js";

const roleManagementGuard =
  (action = "view") =>
  async (req, res, next) => {
    try {
      if (req.user?.role === "super_admin") return next();

      const permissions = await getEffectivePermissions(req.companyId, req.user.role);
      if (canAction(permissions, "settings.roles", action)) return next();

      throw new ApiError(403, "Forbidden - role management access required");
    } catch (err) {
      next(err);
    }
  };

export default roleManagementGuard;
