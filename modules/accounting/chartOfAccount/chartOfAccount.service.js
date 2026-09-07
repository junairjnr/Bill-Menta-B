import ChartOfAccount from "./chartOfAccount.model.js";
import { DEFAULT_ACCOUNTS } from "./defaultAccounts.js";
import ApiError from "../../../utils/ApiError.js";

export const seedDefaultChartOfAccounts = async (companyId, session = null) => {
  const opts = session ? { session } : {};
  const existing = await ChartOfAccount.countDocuments({ companyId }).session(session);
  if (existing > 0) return { seeded: false, count: existing };

  const docs = await ChartOfAccount.insertMany(
    DEFAULT_ACCOUNTS.map((acc) => ({
      companyId,
      ...acc,
      isSystem: true,
    })),
    opts
  );

  return { seeded: true, count: docs.length };
};

export const getAccountMap = async (companyId, session = null) => {
  const accounts = await ChartOfAccount.find({ companyId, isActive: true })
    .session(session)
    .lean();

  const byCode = {};
  for (const acc of accounts) {
    byCode[acc.code] = acc;
  }
  return byCode;
};

export const getAccountByCode = async (companyId, code, session = null) => {
  const account = await ChartOfAccount.findOne({ companyId, code, isActive: true })
    .session(session)
    .lean();
  if (!account) throw new ApiError(500, `Chart of account ${code} not found. Re-seed COA.`);
  return account;
};

export const listAccounts = async (companyId, { accountType } = {}) => {
  const filter = { companyId, isActive: true };
  if (accountType) filter.accountType = accountType;

  return ChartOfAccount.find(filter).sort({ code: 1 }).lean();
};

export const createAccount = async (companyId, body) => {
  const { code, name, accountType, subLedger, isActive } = body;
  if (!code || !name || !accountType) {
    throw new ApiError(400, "code, name, and accountType are required");
  }

  const exists = await ChartOfAccount.findOne({ companyId, code });
  if (exists) throw new ApiError(409, `Account code ${code} already exists`);

  return ChartOfAccount.create({
    companyId,
    code,
    name,
    accountType,
    subLedger,
    isActive,
  });
};

export const updateAccount = async (companyId, id, body) => {
  const account = await ChartOfAccount.findOne({ _id: id, companyId });
  if (!account) throw new ApiError(404, "Account not found");
  if (account.isSystem) throw new ApiError(400, "System accounts cannot be modified");

  if (body.name) account.name = body.name;
  if (body.isActive !== undefined) account.isActive = body.isActive;
  await account.save();
  return account;
};
