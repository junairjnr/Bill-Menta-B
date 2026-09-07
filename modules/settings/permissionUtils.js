import {
  ALL_RESOURCE_KEYS,
  PERMISSION_ACTIONS,
  actionKey,
} from "./permissions.constants.js";

export const mapToObject = (views) => {
  if (!views) return {};
  if (views instanceof Map) return Object.fromEntries(views.entries());
  return { ...views };
};

export const normalizePermissions = (views = {}, fallback = {}) =>
  Object.fromEntries(
    ALL_RESOURCE_KEYS.flatMap((resourceKey) =>
      PERMISSION_ACTIONS.map((action) => {
        const fullKey = actionKey(resourceKey, action);

        if (views[fullKey] !== undefined) {
          return [fullKey, Boolean(views[fullKey])];
        }

        if (views[resourceKey] !== undefined) {
          return [fullKey, Boolean(views[resourceKey])];
        }

        if (fallback[fullKey] !== undefined) {
          return [fullKey, Boolean(fallback[fullKey])];
        }

        if (fallback[resourceKey] !== undefined) {
          return [fullKey, Boolean(fallback[resourceKey])];
        }

        return [fullKey, false];
      })
    )
  );
