/** Effective sales rate — 0/missing salesRate falls back to legacy price. */
export const itemSalesRate = (item) => {
  const salesRate = Number(item?.salesRate);
  if (salesRate > 0) return salesRate;
  return Number(item?.price ?? 0);
};

/** Resolve base rate from DB item and optional invoice row fallback. */
export const resolveItemBaseRate = (dbItem, row = {}, priceLevelPct = 0) => {
  const fromDb = itemSalesRate(dbItem);
  if (fromDb > 0) return fromDb;

  const fromRow = Number(row.baseRate);
  if (fromRow > 0) return fromRow;

  const rowRate = Number(row.rate);
  const pct = Number(priceLevelPct) || 0;
  if (rowRate > 0) {
    return Number((rowRate / (1 + pct / 100)).toFixed(2));
  }

  return 0;
};

/** Effective purchase rate — 0/missing purchaseRate falls back to legacy price. */
export const itemPurchaseRate = (item) => {
  const purchaseRate = Number(item?.purchaseRate);
  if (purchaseRate > 0) return purchaseRate;
  return Number(item?.price ?? 0);
};
