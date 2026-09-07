/** Escape special regex characters in user-provided search strings (ReDoS mitigation). */
export const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const regexContains = (value) => ({
  $regex: escapeRegex(value),
  $options: "i",
});
