import ReceiptPayment from "./receiptPayment.model.js";
import Allocation from "./allocation.model.js";
import SalesInvoice from "../sales/salesInvoice/salesInvoice.model.js";
import PurchaseInvoice from "../purchase/purchaseInvoice/purchaseInvoice.model.js";
import Customer from "../masters/customer/customer.model.js";
import BankAccount from "../masters/bank/bank.model.js";
import ApiError from "../../utils/ApiError.js";
import { withTransaction, sessionOpts } from "../../utils/withTransaction.js";
import { postReceipt, postVendorPayment, reverseDocumentJournal } from "../accounting/journal/posting.service.js";
import { getNextVoucherNo } from "../documentNumber/documentNumber.service.js";
import { regexContains } from "../../utils/escapeRegex.js";
import { optionalSearchString } from "../../utils/sanitizeInput.js";

const partySnapshotFromCustomer = (party) => ({
  name: party.name,
  phone: party.phone || "",
  gstin: party.gstin || "",
  place: party.address?.place || "",
  state: party.address?.state || "",
  stateCode: party.address?.stateCode || "",
  address: [party.address?.line1, party.address?.place, party.address?.city]
    .filter(Boolean)
    .join(", "),
});

const getEffectiveInvoiceTotal = (inv) =>
  Math.max(
    0,
    Number((Number(inv.grandTotal || 0) - Number(inv.returnedAmount || 0)).toFixed(2))
  );

const updateInvoicePayment = (invoice, amountAdjusted) => {
  const paidBefore = invoice.paidAmount ?? 0;
  const newPaid = Number((paidBefore + amountAdjusted).toFixed(2));
  const effectiveTotal = getEffectiveInvoiceTotal(invoice);
  const newBalance = Number((effectiveTotal - newPaid).toFixed(2));
  const newStatus =
    newBalance <= 0.01 ? "paid" : newPaid > 0 ? "partial" : "pending";

  invoice.paidAmount = newPaid;
  invoice.balanceAmount = Math.max(0, newBalance);
  invoice.paymentStatus = newStatus;
};

const reverseInvoicePayment = (invoice, amountAdjusted) => {
  const newPaid = Number(Math.max(0, invoice.paidAmount - amountAdjusted).toFixed(2));
  const effectiveTotal = getEffectiveInvoiceTotal(invoice);
  const newBalance = Number((effectiveTotal - newPaid).toFixed(2));
  const newStatus =
    newPaid <= 0 ? "pending" : newBalance <= 0.01 ? "paid" : "partial";

  invoice.paidAmount = newPaid;
  invoice.balanceAmount = Math.max(0, newBalance);
  invoice.paymentStatus = newStatus;
};

const getInvoiceModel = (invoiceType) =>
  invoiceType === "sales" ? SalesInvoice : PurchaseInvoice;

const partyObjectId = (partyId) => {
  if (!partyId || !String(partyId).match(/^[a-f\d]{24}$/i)) {
    throw new ApiError(400, "Invalid party id");
  }
  return partyId;
};

const computeInvoiceBalance = (inv) => {
  const paid = inv.paidAmount ?? 0;
  const effectiveTotal = getEffectiveInvoiceTotal(inv);
  return Math.max(0, Number((effectiveTotal - paid).toFixed(2)));
};

const computePaymentStatus = (inv) => {
  const effectiveTotal = getEffectiveInvoiceTotal(inv);
  const paid = inv.paidAmount ?? 0;
  if (paid <= 0) return "pending";
  if (paid >= effectiveTotal - 0.009) return "paid";
  return "partial";
};

/** Fix legacy invoices created before paidAmount/balanceAmount/paymentStatus existed. */
const syncLegacyPaymentFields = async (Model, filter) => {
  const docs = await Model.find({
    ...filter,
    status: "confirmed",
    isActive: { $ne: false },
    grandTotal: { $gt: 0 },
  })
    .select("_id grandTotal returnedAmount paidAmount balanceAmount paymentStatus")
    .lean();

  if (!docs.length) return;

  const bulkOps = [];
  for (const inv of docs) {
    const paid = inv.paidAmount ?? 0;
    const balance = computeInvoiceBalance(inv);
    const paymentStatus = computePaymentStatus(inv);

    const needsUpdate =
      (inv.balanceAmount ?? 0) !== balance ||
      (inv.paidAmount ?? 0) !== paid ||
      !inv.paymentStatus ||
      (balance > 0 && inv.paymentStatus === "paid" && paid < getEffectiveInvoiceTotal(inv) - 0.009);

    if (needsUpdate) {
      bulkOps.push({
        updateOne: {
          filter: { _id: inv._id },
          update: {
            $set: {
              paidAmount: paid,
              balanceAmount: balance,
              paymentStatus,
            },
          },
        },
      });
    }
  }

  if (bulkOps.length) await Model.bulkWrite(bulkOps);
};

export const getOutstandingInvoices = async ({
  companyId,
  financialYearId,
  partyId,
  invoiceType,
}) => {
  const Model = getInvoiceModel(invoiceType);
  const partyField = invoiceType === "sales" ? "customerId" : "vendorId";
  const dateField = invoiceType === "sales" ? "invoiceDate" : "purchaseDate";
  const partyOid = partyObjectId(partyId);

  const baseFilter = {
    companyId,
    financialYearId,
    $or: [{ [partyField]: partyOid }, { [partyField]: partyId }],
  };

  await syncLegacyPaymentFields(Model, baseFilter);

  const invoices = await Model.find({
    ...baseFilter,
    status: "confirmed",
    isActive: { $ne: false },
    grandTotal: { $gt: 0 },
  })
    .select(
      `invoiceNo ${dateField} grandTotal returnedAmount paidAmount balanceAmount paymentStatus status createdAt`
    )
    .sort({ [dateField]: 1, createdAt: 1, _id: 1 })
    .lean();

  const mapped = invoices.map((inv) => {
    const paid = inv.paidAmount ?? 0;
    const returnedAmount = inv.returnedAmount ?? 0;
    const effectiveTotal = getEffectiveInvoiceTotal(inv);
    const balance = computeInvoiceBalance(inv);

    return {
      _id: inv._id,
      invoiceNo: inv.invoiceNo,
      invoiceDate: inv[dateField],
      createdAt: inv.createdAt,
      grandTotal: inv.grandTotal,
      returnedAmount,
      effectiveTotal,
      paidAmount: paid,
      balanceAmount: balance,
      paymentStatus: inv.paymentStatus ?? computePaymentStatus(inv),
    };
  });

  const summary = mapped.reduce(
    (acc, inv) => ({
      invoiceCount: acc.invoiceCount + 1,
      totalAmount: Number((acc.totalAmount + inv.effectiveTotal).toFixed(2)),
      totalPaid: Number((acc.totalPaid + inv.paidAmount).toFixed(2)),
      totalOutstanding: Number((acc.totalOutstanding + inv.balanceAmount).toFixed(2)),
    }),
    { invoiceCount: 0, totalAmount: 0, totalPaid: 0, totalOutstanding: 0 }
  );

  const outstanding = mapped.filter((inv) => inv.balanceAmount > 0.009);

  return { invoices: outstanding, summary };
};

export const getVouchersByInvoice = async ({
  companyId,
  invoiceId,
  invoiceType,
  voucherType,
}) => {
  const allocations = await Allocation.find({
    companyId,
    invoiceId,
    invoiceType,
  })
    .sort({ createdAt: 1 })
    .lean();

  if (!allocations.length) return [];

  const voucherIds = [...new Set(allocations.map((a) => String(a.receiptPaymentId)))];
  const vouchers = await ReceiptPayment.find({
    _id: { $in: voucherIds },
    companyId,
    voucherType,
    isActive: true,
    status: { $ne: "cancelled" },
  })
    .sort({ date: 1, createdAt: 1 })
    .lean();

  const voucherMap = Object.fromEntries(vouchers.map((v) => [String(v._id), v]));

  return allocations
    .map((alloc) => {
      const voucher = voucherMap[String(alloc.receiptPaymentId)];
      if (!voucher) return null;

      return {
        ...voucher,
        allocations: [
          {
            invoiceId: String(alloc.invoiceId),
            invoiceNo: alloc.invoiceNo,
            invoiceDate: alloc.invoiceDate,
            invoiceTotal: alloc.invoiceTotal,
            paidBefore: alloc.paidBefore ?? 0,
            amountAdjusted: alloc.amountAdjusted,
            balanceAfter: alloc.balanceAfter,
            invoiceType: alloc.invoiceType,
          },
        ],
      };
    })
    .filter(Boolean);
};

export const createVoucher = async ({
  companyId,
  branchId,
  financialYearId,
  voucherType,
  date,
  partyId,
  paymentMode,
  bankAccountId,
  referenceNo,
  totalAmount,
  allocations,
  notes,
  userId,
}) => {
  return withTransaction(async (session) => {
    const partyType = voucherType === "receipt" ? "customer" : "vendor";
    const partyTypeFilter = voucherType === "receipt" ? "sales" : "purchase";
    const invoiceType = voucherType === "receipt" ? "sales" : "purchase";

    const party = await Customer.findOne({
      _id: partyId,
      companyId,
      type: partyTypeFilter,
      isActive: true,
    }).session(session);
    if (!party) throw new ApiError(404, `${partyType} not found`);

    let bankAccountName = "";
    let bankAccountSnapshot;
    if (bankAccountId) {
      const bank = await BankAccount.findOne({ _id: bankAccountId, companyId }).session(session);
      if (!bank) throw new ApiError(404, "Bank account not found");
      bankAccountName = bank.accountName;
      bankAccountSnapshot = {
        accountName: bank.accountName,
        bankName: bank.bankName,
        accountNumber: bank.accountNumber,
        ifscCode: bank.ifscCode || "",
        upiId: bank.upiId || "",
      };
    }

    const validAllocations = (allocations || []).filter(
      (a) => Number(a.amountAdjusted || a.allocated) > 0
    );
    const totalAdjusted = validAllocations.reduce(
      (s, a) => s + Number(a.amountAdjusted ?? a.allocated),
      0
    );

    if (validAllocations.length === 0) {
      throw new ApiError(400, "Allocate amount to at least one invoice");
    }
    if (Math.abs(totalAdjusted - Number(totalAmount)) > 0.01) {
      throw new ApiError(
        400,
        `Allocation total (${totalAdjusted}) must equal voucher amount (${totalAmount})`
      );
    }

    const processedAllocations = [];
    const Model = getInvoiceModel(invoiceType);
    const partyField = invoiceType === "sales" ? "customerId" : "vendorId";

    await syncLegacyPaymentFields(Model, {
      companyId,
      financialYearId,
      $or: [{ [partyField]: partyObjectId(partyId) }, { [partyField]: partyId }],
    });

    for (const alloc of validAllocations) {
      const amount = Number(alloc.amountAdjusted ?? alloc.allocated);
      const invoice = await Model.findOne({
        _id: alloc.invoiceId,
        companyId,
        financialYearId,
        [partyField]: partyId,
        status: "confirmed",
        isActive: { $ne: false },
      }).session(session);

      if (!invoice) {
        throw new ApiError(
          404,
          `Invoice ${alloc.invoiceId} not found for this ${partyType}`
        );
      }

      const paidBefore = invoice.paidAmount ?? 0;
      const currentBalance = computeInvoiceBalance(invoice);

      if ((invoice.balanceAmount ?? 0) !== currentBalance || !invoice.paymentStatus) {
        invoice.paidAmount = paidBefore;
        invoice.balanceAmount = currentBalance;
        invoice.paymentStatus = computePaymentStatus(invoice);
      }

      if (amount > currentBalance + 0.01) {
        throw new ApiError(
          400,
          `Adjusted ${amount} exceeds balance ${currentBalance} for ${invoice.invoiceNo}`
        );
      }

      updateInvoicePayment(invoice, amount);
      await invoice.save({ session });

      processedAllocations.push({
        invoiceType,
        invoiceId: invoice._id,
        invoiceNo: invoice.invoiceNo,
        invoiceDate: invoice.invoiceDate ?? invoice.purchaseDate,
        invoiceTotal: getEffectiveInvoiceTotal(invoice),
        paidBefore,
        amountAdjusted: amount,
        balanceAfter: invoice.balanceAmount,
      });
    }

    const voucherNo = await getNextVoucherNo(companyId, financialYearId, voucherType);

    const [voucher] = await ReceiptPayment.create(
      [
        {
          companyId,
          branchId,
          financialYearId,
          voucherNo,
          voucherType,
          date: new Date(date),
          partyType,
          partyId,
          partySnapshot: partySnapshotFromCustomer(party),
          paymentMode,
          bankAccountId: bankAccountId || undefined,
          bankAccountSnapshot,
          referenceNo: referenceNo || "",
          totalAmount: Number(totalAmount),
          notes,
          status: "completed",
          createdBy: userId,
          updatedBy: userId,
        },
      ],
      sessionOpts(session)
    );

    await Allocation.insertMany(
      processedAllocations.map((a) => ({
        ...a,
        receiptPaymentId: voucher._id,
        companyId,
        financialYearId,
      })),
      sessionOpts(session)
    );

    if (voucherType === "receipt") {
      await postReceipt(
        { companyId, branchId, financialYearId, voucher, userId },
        session
      );
    } else {
      await postVendorPayment(
        { companyId, branchId, financialYearId, voucher, userId },
        session
      );
    }

    return await getOneVoucher(companyId, voucher._id);
  });
};

export const getAllVouchers = async ({
  companyId,
  branchId,
  financialYearId,
  voucherType,
  partyId,
  paymentMode,
  dateFrom,
  dateTo,
  search,
  page = 1,
  limit = 20,
}) => {
  const filter = {
    companyId,
    branchId,
    financialYearId,
    voucherType,
    isActive: true,
    status: { $ne: "cancelled" },
  };

  if (partyId) filter.partyId = partyId;
  if (paymentMode) filter.paymentMode = paymentMode;
  const safeSearch = optionalSearchString(search);
  if (safeSearch) filter.voucherNo = regexContains(safeSearch);

  if (dateFrom || dateTo) {
    filter.date = {};
    if (dateFrom) filter.date.$gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      filter.date.$lte = end;
    }
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [data, total, summaryRows] = await Promise.all([
    ReceiptPayment.find(filter)
      .populate("partyId", "name phone")
      .sort({ date: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    ReceiptPayment.countDocuments(filter),
    ReceiptPayment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalAmount: { $sum: "$totalAmount" },
        },
      },
    ]),
  ]);

  const voucherIds = data.map((v) => v._id);
  const allocationCounts = voucherIds.length
    ? await Allocation.aggregate([
        { $match: { receiptPaymentId: { $in: voucherIds } } },
        { $group: { _id: "$receiptPaymentId", count: { $sum: 1 } } },
      ])
    : [];

  const countMap = Object.fromEntries(
    allocationCounts.map((row) => [String(row._id), row.count])
  );

  const enriched = data.map((v) => {
    const party = v.partyId && typeof v.partyId === "object" ? v.partyId : null;
    return {
      ...v,
      allocationCount: countMap[String(v._id)] ?? 0,
      partySnapshot:
        v.partySnapshot ??
        (party
          ? {
              name: party.name,
              phone: party.phone || "",
            }
          : v.partySnapshot),
    };
  });

  return {
    data: enriched,
    total,
    page: Number(page),
    totalPages: Math.ceil(total / Number(limit)),
    hasNext: Number(page) < Math.ceil(total / Number(limit)),
    summary: {
      count: summaryRows[0]?.count ?? 0,
      totalAmount: Number((summaryRows[0]?.totalAmount ?? 0).toFixed(2)),
    },
  };
};

export const getOneVoucher = async (companyId, id) => {
  const voucher = await ReceiptPayment.findOne({ _id: id, companyId, isActive: true })
    .populate("partyId", "name phone gstin address")
    .populate("bankAccountId", "accountName bankName accountNumber ifscCode upiId branch")
    .lean();

  if (!voucher) throw new ApiError(404, "Voucher not found");

  const allocations = await Allocation.find({ receiptPaymentId: id })
    .sort({ invoiceDate: 1 })
    .lean();

  const party =
    voucher.partyId && typeof voucher.partyId === "object" ? voucher.partyId : null;

  const partySnapshot =
    voucher.partySnapshot ??
    (party
      ? {
          name: party.name,
          phone: party.phone || "",
          gstin: party.gstin || "",
          place: party.address?.place || "",
          state: party.address?.state || "",
          stateCode: party.address?.stateCode || "",
          address: [party.address?.line1, party.address?.place, party.address?.city]
            .filter(Boolean)
            .join(", "),
        }
      : undefined);

  const bankPopulated =
    voucher.bankAccountId && typeof voucher.bankAccountId === "object"
      ? voucher.bankAccountId
      : null;

  const bankAccountSnapshot =
    voucher.bankAccountSnapshot?.bankName
      ? voucher.bankAccountSnapshot
      : bankPopulated
        ? {
            accountName: bankPopulated.accountName,
            bankName: bankPopulated.bankName,
            accountNumber: bankPopulated.accountNumber,
            ifscCode: bankPopulated.ifscCode || "",
            upiId: bankPopulated.upiId || "",
          }
        : undefined;

  return {
    ...voucher,
    partySnapshot,
    bankAccountSnapshot,
    allocations: allocations.map((a) => ({
      invoiceId: String(a.invoiceId),
      invoiceNo: a.invoiceNo,
      invoiceDate: a.invoiceDate,
      invoiceTotal: a.invoiceTotal,
      paidBefore: a.paidBefore ?? 0,
      amountAdjusted: a.amountAdjusted,
      balanceAfter: a.balanceAfter,
      invoiceType: a.invoiceType,
    })),
  };
};

export const deleteVoucher = async (companyId, id, userId) => {
  return withTransaction(async (session) => {
    const voucher = await ReceiptPayment.findOne({
      _id: id,
      companyId,
      isActive: true,
    }).session(session);

    if (!voucher) throw new ApiError(404, "Voucher not found");

    const allocations = await Allocation.find({ receiptPaymentId: id }).session(session);
    const Model = (invoiceType) => getInvoiceModel(invoiceType);

    for (const alloc of allocations) {
      const invoice = await Model(alloc.invoiceType)
        .findOne({ _id: alloc.invoiceId, companyId })
        .session(session);
      if (invoice) {
        reverseInvoicePayment(invoice, alloc.amountAdjusted);
        await invoice.save({ session });
      }
    }

    await Allocation.deleteMany({ receiptPaymentId: id }, sessionOpts(session));

    await reverseDocumentJournal(
      {
        companyId,
        branchId: voucher.branchId,
        financialYearId: voucher.financialYearId,
        referenceType: "ReceiptPayment",
        referenceId: voucher._id,
        entryDate: new Date(),
        userId,
      },
      session
    );

    voucher.status = "cancelled";
    voucher.isActive = false;
    voucher.updatedBy = userId;
    await voucher.save({ session });

    return { message: "Voucher cancelled successfully" };
  });
};

// Backward-compatible adapter for old payment API
export const createLegacyReceipt = async (payload) =>
  createVoucher({
    ...payload,
    voucherType: "receipt",
    date: payload.receiptDate ?? payload.date,
    partyId: payload.customerId ?? payload.partyId,
    totalAmount: payload.amount ?? payload.totalAmount,
    allocations: (payload.allocations || []).map((a) => ({
      invoiceId: a.invoiceId,
      amountAdjusted: a.allocated ?? a.amountAdjusted,
    })),
  });

export const getLegacyOutstanding = async (companyId, financialYearId, customerId) =>
  getOutstandingInvoices({
    companyId,
    financialYearId,
    partyId: customerId,
    invoiceType: "sales",
  });
