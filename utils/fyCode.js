/**
 * FY label for document numbers — same as stored label, e.g. "2026-27".
 * Used in PINV / RCPT / PAY / EXP / JE number prefixes.
 */
export const getFYDocumentCode = (label) => String(label ?? "").trim();

/** Last numeric segment of PINV-2026-27-0001 (also handles legacy formats) */
export const getDocumentSequence = (docNo) => {
  const parts = String(docNo ?? "").split("-");
  return parseInt(parts[parts.length - 1], 10) || 0;
};
