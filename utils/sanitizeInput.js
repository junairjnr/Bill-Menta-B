import ApiError from "./ApiError.js";

/** Reject NoSQL operator injection via object/array query values. */
export const requireString = (value, fieldName, { maxLength = 500 } = {}) => {
  if (typeof value !== "string") {
    throw new ApiError(400, `${fieldName} must be a string`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ApiError(400, `${fieldName} is required`);
  }
  if (trimmed.length > maxLength) {
    throw new ApiError(400, `${fieldName} is too long`);
  }
  return trimmed;
};

export const optionalSearchString = (value, maxLength = 100) => {
  if (value == null || value === "") return undefined;
  if (typeof value !== "string") {
    throw new ApiError(400, "Search must be a string");
  }
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
};
