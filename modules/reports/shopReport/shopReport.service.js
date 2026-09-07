import SalesInvoice from "../../sales/salesInvoice/salesInvoice.model.js";
import SalesReturn from "../../sales/salesReturn/salesReturn.model.js";
import PurchaseInvoice from "../../purchase/purchaseInvoice/purchaseInvoice.model.js";
import PurchaseReturn from "../../purchase/purchaseReturn/purchaseReturn.model.js";
import ReceiptPayment from "../../receipt-payment/receiptPayment.model.js";

const buildDateFilter = (dateFrom, dateTo) => {
  if (!dateFrom && !dateTo) return null;
  const filter = {};
  if (dateFrom) filter.$gte = new Date(dateFrom);
  if (dateTo) {
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);
    filter.$lte = end;
  }
  return filter;
};

const applyDate = (filter, field, dateFilter) => {
  if (dateFilter) filter[field] = dateFilter;
  return filter;
};

const partyName = (snapshot, populated) =>
  snapshot?.name || (typeof populated === "object" ? populated?.name : "") || "—";

const includeCustomerSide = (partyType) => !partyType || partyType === "customer";
const includeVendorSide = (partyType) => !partyType || partyType === "vendor";

const fetchCustomerEntries = async ({
  companyId,
  financialYearId,
  partyId,
  dateFilter,
  partyType,
}) => {
  if (!includeCustomerSide(partyType)) return [];

  const base = {
    companyId,
    financialYearId,
    isActive: { $ne: false },
  };
  if (partyId) base.customerId = partyId;

  const [invoices, returns, receipts] = await Promise.all([
    SalesInvoice.find(applyDate({ ...base, status: "confirmed" }, "invoiceDate", dateFilter))
      .select("invoiceNo invoiceDate grandTotal paymentStatus salesType customerId customerSnapshot")
      .lean(),
    SalesReturn.find(applyDate({ ...base, status: "confirmed" }, "returnDate", dateFilter))
      .select("returnNo returnDate grandTotal salesType customerId customerSnapshot")
      .lean(),
    ReceiptPayment.find(
      applyDate(
        {
          companyId,
          financialYearId,
          voucherType: "receipt",
          status: { $ne: "cancelled" },
          isActive: { $ne: false },
          ...(partyId ? { partyId } : {}),
        },
        "date",
        dateFilter
      )
    )
      .select("voucherNo date totalAmount paymentMode partyId partySnapshot")
      .lean(),
  ]);

  return [
    ...invoices.map((inv) => ({
      _id: inv._id,
      date: inv.invoiceDate,
      type: "sales",
      refNo: inv.invoiceNo,
      partyName: partyName(inv.customerSnapshot, inv.customerId),
      partyType: "customer",
      salesType: inv.salesType,
      debit: Number(inv.grandTotal || 0),
      credit: 0,
      status: inv.paymentStatus,
    })),
    ...returns.map((ret) => ({
      _id: ret._id,
      date: ret.returnDate,
      type: "sales_return",
      refNo: ret.returnNo,
      partyName: partyName(ret.customerSnapshot, ret.customerId),
      partyType: "customer",
      salesType: ret.salesType,
      debit: 0,
      credit: Number(ret.grandTotal || 0),
      status: "confirmed",
    })),
    ...receipts.map((rcpt) => ({
      _id: rcpt._id,
      date: rcpt.date,
      type: "receipt",
      refNo: rcpt.voucherNo,
      partyName: partyName(rcpt.partySnapshot, rcpt.partyId),
      partyType: "customer",
      debit: 0,
      credit: Number(rcpt.totalAmount || 0),
      paymentMode: rcpt.paymentMode,
      status: "completed",
    })),
  ];
};

const fetchVendorEntries = async ({
  companyId,
  financialYearId,
  partyId,
  dateFilter,
  partyType,
}) => {
  if (!includeVendorSide(partyType)) return [];

  const base = {
    companyId,
    financialYearId,
    isActive: { $ne: false },
  };
  if (partyId) base.vendorId = partyId;

  const [invoices, returns, payments] = await Promise.all([
    PurchaseInvoice.find(applyDate({ ...base, status: "confirmed" }, "purchaseDate", dateFilter))
      .select("invoiceNo purchaseDate grandTotal paymentStatus vendorId vendorSnapshot")
      .lean(),
    PurchaseReturn.find(applyDate({ ...base, status: "confirmed" }, "returnDate", dateFilter))
      .select("returnNo returnDate grandTotal vendorId vendorSnapshot")
      .lean(),
    ReceiptPayment.find(
      applyDate(
        {
          companyId,
          financialYearId,
          voucherType: "payment",
          status: { $ne: "cancelled" },
          isActive: { $ne: false },
          ...(partyId ? { partyId } : {}),
        },
        "date",
        dateFilter
      )
    )
      .select("voucherNo date totalAmount paymentMode partyId partySnapshot")
      .lean(),
  ]);

  return [
    ...invoices.map((inv) => ({
      _id: inv._id,
      date: inv.purchaseDate,
      type: "purchase",
      refNo: inv.invoiceNo,
      partyName: partyName(inv.vendorSnapshot, inv.vendorId),
      partyType: "vendor",
      debit: 0,
      credit: Number(inv.grandTotal || 0),
      status: inv.paymentStatus,
    })),
    ...returns.map((ret) => ({
      _id: ret._id,
      date: ret.returnDate,
      type: "purchase_return",
      refNo: ret.returnNo,
      partyName: partyName(ret.vendorSnapshot, ret.vendorId),
      partyType: "vendor",
      debit: Number(ret.grandTotal || 0),
      credit: 0,
      status: "confirmed",
    })),
    ...payments.map((pay) => ({
      _id: pay._id,
      date: pay.date,
      type: "payment",
      refNo: pay.voucherNo,
      partyName: partyName(pay.partySnapshot, pay.partyId),
      partyType: "vendor",
      debit: Number(pay.totalAmount || 0),
      credit: 0,
      paymentMode: pay.paymentMode,
      status: "completed",
    })),
  ];
};

const entryKey = (entry) => `${entry.type}-${entry._id}`;

export const getShopReport = async ({
  companyId,
  financialYearId,
  partyType,
  partyId,
  dateFrom,
  dateTo,
  page = 1,
  limit = 20,
}) => {
  const dateFilter = buildDateFilter(dateFrom, dateTo);
  const normalizedPartyType =
    partyType === "customer" || partyType === "vendor" ? partyType : undefined;

  const [customerEntries, vendorEntries] = await Promise.all([
    fetchCustomerEntries({
      companyId,
      financialYearId,
      partyId,
      dateFilter,
      partyType: normalizedPartyType,
    }),
    fetchVendorEntries({
      companyId,
      financialYearId,
      partyId,
      dateFilter,
      partyType: normalizedPartyType,
    }),
  ]);

  const allEntries = [...customerEntries, ...vendorEntries].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const totalDebit = Number(
    allEntries.reduce((sum, entry) => sum + entry.debit, 0).toFixed(2)
  );
  const totalCredit = Number(
    allEntries.reduce((sum, entry) => sum + entry.credit, 0).toFixed(2)
  );
  const outstanding = Number((totalDebit - totalCredit).toFixed(2));

  const balanceByKey = new Map();
  if (partyId) {
    let runningBalance = 0;
    allEntries.forEach((entry) => {
      runningBalance = Number((runningBalance + entry.debit - entry.credit).toFixed(2));
      balanceByKey.set(entryKey(entry), runningBalance);
    });
  }

  const rowsDesc = [...allEntries]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .map((entry) => ({
      ...entry,
      balance: partyId ? balanceByKey.get(entryKey(entry)) ?? 0 : null,
    }));

  const total = rowsDesc.length;
  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.max(1, Number(limit));
  const skip = (pageNum - 1) * limitNum;
  const rows = rowsDesc.slice(skip, skip + limitNum);
  const totalPages = Math.max(1, Math.ceil(total / limitNum));

  return {
    rows,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages,
    hasNext: pageNum < totalPages,
    summary: { totalDebit, totalCredit, outstanding },
  };
};
