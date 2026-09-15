import BankAccount from "../modules/masters/bank/bank.model.js";
import ApiError from "./ApiError.js";

const VALID_MODES = ["cash", "bank", "bank_transfer", "upi", "cheque", "card", "other"];
const NEEDS_BANK = ["bank", "bank_transfer", "upi", "cheque"];

export const round2 = (n) => Number(Number(n).toFixed(2));

export const needsBankAccount = (mode) => NEEDS_BANK.includes(mode);

export const resolvePaymentStatus = (paidAmount, grandTotal, saleMode) => {
  const grand = round2(grandTotal);
  const paid = round2(paidAmount);

  if (grand <= 0) return "pending";
  if (paid >= grand - 0.009) return "paid";
  if (paid > 0) return "partial";
  if (saleMode === "credit") return "unpaid";
  return "pending";
};

/** Split received amount across payment modes — does not determine paidAmount. */
export const normalizeInvoicePaymentSplits = async ({
  companyId,
  payments,
  paidAmount,
  session,
}) => {
  const paid = round2(paidAmount);
  if (paid <= 0) return { normalizedPayments: [] };

  const rows = Array.isArray(payments) ? payments : [];
  const normalizedPayments = [];
  let splitTotal = 0;

  for (const row of rows) {
    const amount = round2(Math.max(0, Number(row.amount) || 0));
    if (amount <= 0) continue;

    const paymentMode = String(row.paymentMode || "cash").toLowerCase();
    if (!VALID_MODES.includes(paymentMode)) {
      throw new ApiError(400, `Invalid payment mode: ${paymentMode}`);
    }

    let bankAccountSnapshot;
    if (needsBankAccount(paymentMode)) {
      if (!row.bankAccountId) {
        throw new ApiError(400, "Bank account is required for this payment mode");
      }
      const bank = await BankAccount.findOne({
        _id: row.bankAccountId,
        companyId,
        isActive: true,
      }).session(session);
      if (!bank) throw new ApiError(404, "Bank account not found");

      bankAccountSnapshot = {
        accountName: bank.accountName,
        bankName: bank.bankName,
        accountNumber: bank.accountNumber,
        ifscCode: bank.ifscCode || "",
        upiId: bank.upiId || "",
      };
    }

    splitTotal = round2(splitTotal + amount);
    normalizedPayments.push({
      paymentMode,
      bankAccountId: row.bankAccountId || undefined,
      bankAccountSnapshot,
      amount,
      referenceNo: String(row.referenceNo || "").trim(),
    });
  }

  if (normalizedPayments.length === 0) return { normalizedPayments: [] };

  if (splitTotal > paid + 0.009) {
    throw new ApiError(400, "Payment split exceeds received amount");
  }
  if (splitTotal < paid - 0.009) {
    throw new ApiError(400, "Payment split must equal received amount");
  }

  return { normalizedPayments };
};

export const resolveInvoicePaymentFromInput = ({
  grandTotal,
  receivedInput = 0,
  saleMode = "cash",
  autoFullPayment = true,
}) => {
  const grand = round2(grandTotal);
  if (grand <= 0) {
    return {
      paidAmount: 0,
      balanceAmount: 0,
      paymentStatus: "pending",
    };
  }

  let received = round2(Math.max(0, Number(receivedInput) || 0));

  if (saleMode === "credit") {
    received = round2(Math.max(0, Number(receivedInput) || 0));
  } else if (autoFullPayment && received <= 0 && grand > 0) {
    received = grand;
  }

  const paidAmount = received > grand ? grand : received;
  const balanceAmount = round2(grand - paidAmount);

  return {
    paidAmount,
    balanceAmount,
    paymentStatus: resolvePaymentStatus(paidAmount, grand, saleMode),
  };
};
