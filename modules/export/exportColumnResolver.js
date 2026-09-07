export const SLNO_KEY = "slno";

export const SLNO_COLUMN = {
  key: SLNO_KEY,
  header: "Sl No",
  default: true,
  virtual: true,
  width: 8,
  get: (_row, index) => index + 1,
};

const findConfigColumn = (config, key) => {
  const direct = config.columns.find((col) => col.key === key);
  if (direct) return direct;

  const aliasMap = {
    tax: "totalTax",
    debit: "debitBalance",
    credit: "creditBalance",
    account: "accountName",
    customer: "customerSnapshot",
    vendor: "vendorSnapshot",
  };

  if (aliasMap[key]) {
    const aliased = config.columns.find((col) => col.key === aliasMap[key]);
    if (aliased) return aliased;
  }

  if (key === "date") {
    for (const dateKey of [
      "date",
      "purchaseDate",
      "invoiceDate",
      "entryDate",
      "returnDate",
      "createdAt",
    ]) {
      const col = config.columns.find((c) => c.key === dateKey);
      if (col) return col;
    }
  }

  if (key === "type") {
    for (const typeKey of ["salesType", "accountType", "entryType", "movementType"]) {
      const col = config.columns.find((c) => c.key === typeKey);
      if (col) return col;
    }
  }

  if (key === "name") {
    for (const nameKey of ["name", "accountName"]) {
      const col = config.columns.find((c) => c.key === nameKey);
      if (col) return col;
    }
  }

  return null;
};

const normalizeKey = (key) => {
  if (key === "rowNum" || key === "#") return SLNO_KEY;
  return key;
};

/** Resolve selected column keys (from frontend) into export column defs, preserving order. */
export const resolveSelectedColumns = (config, selectedKeys) => {
  if (!selectedKeys?.length) {
    return config.columns.filter((col) => col.default !== false);
  }

  return selectedKeys
    .map((rawKey) => {
      const key = normalizeKey(rawKey);
      if (key === SLNO_KEY) return SLNO_COLUMN;
      return findConfigColumn(config, key);
    })
    .filter(Boolean);
};

/** Column metadata for GET /export/:type/columns — includes Sl No when supported. */
export const listColumnMetaWithSlNo = (config, { includeSlNo = true } = {}) => {
  const cols = config.columns.map(({ key, header, default: isDefault }) => ({
    key,
    label: header,
    default: isDefault !== false,
  }));

  if (!includeSlNo || cols.some((c) => c.key === SLNO_KEY)) {
    return cols;
  }

  return [{ key: SLNO_KEY, label: "Sl No", default: true }, ...cols];
};
