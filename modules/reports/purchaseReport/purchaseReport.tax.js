const DEFAULT_GST_PERCENT = 18;

const lineTaxableValue = (item) =>
  Number(
    (
      item.taxableValue ??
      Number(item.qty || 0) * Number(item.rate || 0)
    ).toFixed(2)
  );

const lineTaxAmounts = (item) => {
  const taxableValue = lineTaxableValue(item);
  const taxPercent = Number(item.taxPercent) || DEFAULT_GST_PERCENT;

  const sgst =
    item.sgst != null && item.sgst > 0
      ? Number(item.sgst)
      : Number(((taxableValue * taxPercent) / 200).toFixed(2));

  const cgst =
    item.cgst != null && item.cgst > 0
      ? Number(item.cgst)
      : Number(((taxableValue * taxPercent) / 200).toFixed(2));

  return { sgst, cgst };
};

export const getPurchaseInvoiceTaxTotals = (invoice) => {
  const items = invoice.items ?? [];
  let totalSGST = 0;
  let totalCGST = 0;

  for (const item of items) {
    const { sgst, cgst } = lineTaxAmounts(item);
    totalSGST += sgst;
    totalCGST += cgst;
  }

  totalSGST = Number(totalSGST.toFixed(2));
  totalCGST = Number(totalCGST.toFixed(2));

  if (totalSGST || totalCGST) {
    return {
      totalSGST,
      totalCGST,
      totalTax: Number((totalSGST + totalCGST).toFixed(2)),
    };
  }

  return {
    totalSGST: Number(invoice.totalSGST ?? 0),
    totalCGST: Number(invoice.totalCGST ?? 0),
    totalTax: Number(
      invoice.totalTax ?? (invoice.totalSGST ?? 0) + (invoice.totalCGST ?? 0)
    ),
  };
};

export const withPurchaseInvoiceTaxTotals = (invoice) => {
  const tax = getPurchaseInvoiceTaxTotals(invoice);
  return { ...invoice, ...tax };
};
