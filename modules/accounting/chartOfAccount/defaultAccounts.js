/** Standard chart of accounts seeded on company registration */
export const DEFAULT_ACCOUNTS = [
  { code: "1100", name: "Accounts Receivable", accountType: "asset", subLedger: "customer" },
  { code: "1200", name: "Inventory", accountType: "asset" },
  { code: "1300", name: "Cash", accountType: "asset" },
  { code: "1310", name: "Bank", accountType: "asset" },
  { code: "2100", name: "Accounts Payable", accountType: "liability", subLedger: "vendor" },
  { code: "2200", name: "GST Payable (Output)", accountType: "liability" },
  { code: "2210", name: "GST Input", accountType: "asset" },
  { code: "3100", name: "Capital", accountType: "equity" },
  { code: "4100", name: "Sales Revenue", accountType: "income" },
  { code: "5100", name: "Cost of Goods Sold", accountType: "expense" },
  { code: "5200", name: "Operating Expenses", accountType: "expense" },
  { code: "5300", name: "Round Off", accountType: "expense" },
];

export const ACCOUNT_CODES = Object.fromEntries(
  DEFAULT_ACCOUNTS.map((a) => [a.name.replace(/\s+/g, "_").toUpperCase(), a.code])
);

export const COA = {
  ACCOUNTS_RECEIVABLE: "1100",
  INVENTORY: "1200",
  CASH: "1300",
  BANK: "1310",
  ACCOUNTS_PAYABLE: "2100",
  GST_PAYABLE: "2200",
  GST_INPUT: "2210",
  CAPITAL: "3100",
  SALES: "4100",
  COGS: "5100",
  EXPENSE: "5200",
  ROUND_OFF: "5300",
};
