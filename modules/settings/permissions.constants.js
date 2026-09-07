export const MANAGED_ROLES = [
  "admin",
  "secondary_admin",
  "salesman",
  "biller",
  "accountant",
  "stock_keeper",
  "viewer",
  "manager",
  "staff",
];

export const SYSTEM_USER_ROLES = ["super_admin", ...MANAGED_ROLES];

export const ASSIGNABLE_ROLES = MANAGED_ROLES;

export const PRIVILEGED_ROLES = ["admin", "secondary_admin"];

export const ROLE_META = {
  admin: {
    label: "Admin",
    description: "Primary admin with full business access.",
  },
  secondary_admin: {
    label: "Secondary Admin",
    description: "Broad business access; can help manage operations and users.",
  },
  salesman: {
    label: "Salesman",
    description: "Customer and sales-related work.",
  },
  biller: {
    label: "Biller",
    description: "Create and manage billing and invoices.",
  },
  accountant: {
    label: "Accountant",
    description: "Accounts, payments, and financial reporting work.",
  },
  stock_keeper: {
    label: "Stock Keeper",
    description: "Inventory, stock, and item-related work.",
  },
  viewer: {
    label: "Viewer",
    description: "View permitted business information only.",
  },
  manager: {
    label: "Manager (Legacy)",
    description: "Legacy role — prefer Secondary Admin or department roles.",
  },
  staff: {
    label: "Staff (Legacy)",
    description: "Legacy role — prefer Viewer or department roles.",
  },
};

export const PERMISSION_ACTIONS = ["view", "add", "edit", "delete"];

export const PERMISSION_SECTIONS = [
  {
    title: "MAIN",
    resources: [{ key: "dashboard", label: "Dashboard" }],
  },
  {
    title: "MASTER",
    resources: [
      { key: "master.product", label: "Product" },
      { key: "master.customer", label: "Customer" },
      { key: "master.category", label: "Category" },
      { key: "master.uom", label: "UOM" },
      { key: "master.priceLevel", label: "Price Level" },
      { key: "master.branch", label: "Branch" },
      { key: "master.financialYear", label: "Financial Year" },
      { key: "master.warehouse", label: "Warehouse" },
      { key: "master.bank", label: "Bank Account" },
    ],
  },
  {
    title: "SALES",
    resources: [
      { key: "sales.invoice", label: "Sales Invoice" },
      { key: "sales.return", label: "Sales Return" },
    ],
  },
  {
    title: "PURCHASE",
    resources: [
      { key: "purchase.invoice", label: "Purchase Invoice" },
      { key: "purchase.return", label: "Purchase Return" },
    ],
  },
  {
    title: "RECEIPT / PAYMENT",
    resources: [
      { key: "receipt.voucher", label: "Receipt Voucher" },
      { key: "payment.voucher", label: "Payment Voucher" },
    ],
  },
  {
    title: "EXPENSE",
    resources: [
      { key: "expense.voucher", label: "Expense Entry" },
      { key: "reports.expense", label: "Expense Report" },
    ],
  },
  {
    title: "ACCOUNTING",
    resources: [
      { key: "accounting.entries", label: "Journal Entries" },
      { key: "accounting.customerBalance", label: "Customer Outstanding" },
      { key: "accounting.subLedgers", label: "Sub Ledgers" },
      { key: "accounting.trialBalance", label: "Trial Balance" },
      { key: "accounting.profitLoss", label: "Profit & Loss" },
      { key: "accounting.balanceSheet", label: "Balance Sheet" },
      { key: "accounting.chartOfAccounts", label: "Chart of Accounts" },
      { key: "accounting.manualJournal", label: "Manual Journal" },
    ],
  },
  {
    title: "REPORTS",
    resources: [
      { key: "reports.stock", label: "Stock Report" },
      { key: "reports.sales", label: "Sales Report" },
      { key: "reports.purchase", label: "Purchase Report" },
      { key: "reports.shop", label: "Ledger Report" },
      { key: "reports.purchaseHistory", label: "Purchase History" },
      { key: "reports.salesHistory", label: "Sales History" },
      { key: "reports.salesReturnHistory", label: "Sales Return History" },
      { key: "reports.purchaseReturnHistory", label: "Purchase Return History" },
    ],
  },
  {
    title: "SETTINGS",
    resources: [
      { key: "settings.company", label: "Company" },
      { key: "settings.users", label: "Users" },
      { key: "settings.roles", label: "Roles" },
      { key: "settings.permissions", label: "Role Permissions" },
    ],
  },
];

export const ALL_RESOURCE_KEYS = PERMISSION_SECTIONS.flatMap((section) =>
  section.resources.map((resource) => resource.key)
);

export const actionKey = (resourceKey, action) => `${resourceKey}.${action}`;

export const ALL_PERMISSION_KEYS = ALL_RESOURCE_KEYS.flatMap((resourceKey) =>
  PERMISSION_ACTIONS.map((action) => actionKey(resourceKey, action))
);

/** @deprecated Use PERMISSION_SECTIONS — kept for backward-compatible catalog shape */
export const VIEW_PERMISSIONS = PERMISSION_SECTIONS.flatMap((section) =>
  section.resources.map((resource) => ({
    key: resource.key,
    label: resource.label,
    group: section.title,
  }))
);

export const ALL_VIEW_KEYS = ALL_RESOURCE_KEYS;

const buildPermissionsFromViewMap = (viewMap = {}, { viewOnly = false } = {}) =>
  Object.fromEntries(
    ALL_RESOURCE_KEYS.flatMap((resourceKey) => {
      const enabled = Boolean(viewMap[resourceKey]);
      return PERMISSION_ACTIONS.map((action) => [
        actionKey(resourceKey, action),
        viewOnly ? action === "view" && enabled : enabled,
      ]);
    })
  );

const buildCrudFromViewMap = (viewMap = {}) =>
  buildPermissionsFromViewMap(viewMap, { viewOnly: false });

const DEFAULT_ROLE_VIEW_ACCESS = {
  admin: Object.fromEntries(ALL_RESOURCE_KEYS.map((key) => [key, true])),
  secondary_admin: {
    dashboard: true,
    "master.product": true,
    "master.customer": true,
    "master.category": true,
    "master.uom": true,
    "master.priceLevel": true,
    "master.branch": true,
    "master.financialYear": true,
    "master.warehouse": true,
    "master.bank": true,
    "sales.invoice": true,
    "sales.return": true,
    "purchase.invoice": true,
    "purchase.return": true,
    "receipt.voucher": true,
    "payment.voucher": true,
    "reports.stock": true,
    "reports.sales": true,
    "reports.purchase": true,
    "reports.shop": true,
    "reports.purchaseHistory": true,
    "reports.salesHistory": true,
    "reports.salesReturnHistory": true,
    "reports.purchaseReturnHistory": true,
    "expense.voucher": true,
    "reports.expense": true,
    "accounting.entries": true,
    "accounting.customerBalance": true,
    "accounting.subLedgers": true,
    "accounting.trialBalance": false,
    "accounting.profitLoss": false,
    "accounting.balanceSheet": false,
    "accounting.chartOfAccounts": false,
    "accounting.manualJournal": true,
    "settings.company": true,
    "settings.users": true,
    "settings.roles": true,
    "settings.permissions": false,
  },
  salesman: {
    dashboard: true,
    "master.product": true,
    "master.customer": true,
    "master.category": false,
    "master.uom": false,
    "master.priceLevel": true,
    "master.branch": false,
    "master.financialYear": false,
    "master.warehouse": false,
    "master.bank": false,
    "sales.invoice": true,
    "sales.return": true,
    "purchase.invoice": false,
    "purchase.return": false,
    "receipt.voucher": false,
    "payment.voucher": false,
    "reports.stock": false,
    "reports.sales": true,
    "reports.purchase": false,
    "reports.shop": true,
    "reports.purchaseHistory": false,
    "reports.salesHistory": true,
    "reports.salesReturnHistory": true,
    "reports.purchaseReturnHistory": false,
    "expense.voucher": false,
    "reports.expense": false,
    "accounting.entries": false,
    "accounting.customerBalance": true,
    "accounting.subLedgers": false,
    "accounting.trialBalance": false,
    "accounting.profitLoss": false,
    "accounting.balanceSheet": false,
    "accounting.chartOfAccounts": false,
    "accounting.manualJournal": false,
    "settings.company": false,
    "settings.users": false,
    "settings.roles": false,
    "settings.permissions": false,
  },
  biller: {
    dashboard: true,
    "master.product": true,
    "master.customer": true,
    "master.category": false,
    "master.uom": false,
    "master.priceLevel": true,
    "master.branch": false,
    "master.financialYear": false,
    "master.warehouse": false,
    "master.bank": false,
    "sales.invoice": true,
    "sales.return": true,
    "purchase.invoice": false,
    "purchase.return": false,
    "receipt.voucher": true,
    "payment.voucher": false,
    "reports.stock": false,
    "reports.sales": true,
    "reports.purchase": false,
    "reports.shop": true,
    "reports.purchaseHistory": false,
    "reports.salesHistory": true,
    "reports.salesReturnHistory": true,
    "reports.purchaseReturnHistory": false,
    "expense.voucher": false,
    "reports.expense": false,
    "accounting.entries": false,
    "accounting.customerBalance": true,
    "accounting.subLedgers": false,
    "accounting.trialBalance": false,
    "accounting.profitLoss": false,
    "accounting.balanceSheet": false,
    "accounting.chartOfAccounts": false,
    "accounting.manualJournal": false,
    "settings.company": false,
    "settings.users": false,
    "settings.roles": false,
    "settings.permissions": false,
  },
  accountant: {
    dashboard: true,
    "master.product": false,
    "master.customer": true,
    "master.category": false,
    "master.uom": false,
    "master.priceLevel": false,
    "master.branch": false,
    "master.financialYear": true,
    "master.warehouse": false,
    "master.bank": true,
    "sales.invoice": false,
    "sales.return": false,
    "purchase.invoice": false,
    "purchase.return": false,
    "receipt.voucher": true,
    "payment.voucher": true,
    "reports.stock": false,
    "reports.sales": true,
    "reports.purchase": true,
    "reports.shop": true,
    "reports.purchaseHistory": true,
    "reports.salesHistory": true,
    "reports.salesReturnHistory": true,
    "reports.purchaseReturnHistory": true,
    "expense.voucher": true,
    "reports.expense": true,
    "accounting.entries": true,
    "accounting.customerBalance": true,
    "accounting.subLedgers": true,
    "accounting.trialBalance": true,
    "accounting.profitLoss": true,
    "accounting.balanceSheet": true,
    "accounting.chartOfAccounts": true,
    "accounting.manualJournal": true,
    "settings.company": false,
    "settings.users": false,
    "settings.roles": false,
    "settings.permissions": false,
  },
  stock_keeper: {
    dashboard: true,
    "master.product": true,
    "master.customer": false,
    "master.category": true,
    "master.uom": true,
    "master.priceLevel": false,
    "master.branch": false,
    "master.financialYear": false,
    "master.warehouse": true,
    "master.bank": false,
    "sales.invoice": false,
    "sales.return": false,
    "purchase.invoice": true,
    "purchase.return": true,
    "receipt.voucher": false,
    "payment.voucher": false,
    "reports.stock": true,
    "reports.sales": false,
    "reports.purchase": true,
    "reports.shop": false,
    "reports.purchaseHistory": true,
    "reports.salesHistory": false,
    "reports.salesReturnHistory": false,
    "reports.purchaseReturnHistory": true,
    "expense.voucher": false,
    "reports.expense": false,
    "accounting.entries": false,
    "accounting.customerBalance": false,
    "accounting.subLedgers": false,
    "accounting.trialBalance": false,
    "accounting.profitLoss": false,
    "accounting.balanceSheet": false,
    "accounting.chartOfAccounts": false,
    "accounting.manualJournal": false,
    "settings.company": false,
    "settings.users": false,
    "settings.roles": false,
    "settings.permissions": false,
  },
  viewer: {
    dashboard: true,
    "master.product": true,
    "master.customer": true,
    "master.category": true,
    "master.uom": true,
    "master.priceLevel": true,
    "master.branch": true,
    "master.financialYear": false,
    "master.warehouse": true,
    "master.bank": false,
    "sales.invoice": true,
    "sales.return": true,
    "purchase.invoice": true,
    "purchase.return": true,
    "receipt.voucher": true,
    "payment.voucher": true,
    "reports.stock": true,
    "reports.sales": true,
    "reports.purchase": true,
    "reports.shop": true,
    "reports.purchaseHistory": true,
    "reports.salesHistory": true,
    "reports.salesReturnHistory": true,
    "reports.purchaseReturnHistory": true,
    "expense.voucher": true,
    "reports.expense": true,
    "accounting.entries": true,
    "accounting.customerBalance": true,
    "accounting.subLedgers": true,
    "accounting.trialBalance": true,
    "accounting.profitLoss": true,
    "accounting.balanceSheet": true,
    "accounting.chartOfAccounts": true,
    "accounting.manualJournal": false,
    "settings.company": false,
    "settings.users": false,
    "settings.roles": false,
    "settings.permissions": false,
  },
  manager: {
    dashboard: true,
    "master.product": true,
    "master.customer": true,
    "master.category": true,
    "master.uom": true,
    "master.priceLevel": true,
    "master.warehouse": true,
    "master.bank": false,
    "master.branch": false,
    "master.financialYear": false,
    "sales.invoice": true,
    "sales.return": true,
    "purchase.invoice": true,
    "purchase.return": true,
    "receipt.voucher": true,
    "payment.voucher": true,
    "reports.stock": true,
    "reports.sales": true,
    "reports.purchase": true,
    "reports.shop": true,
    "reports.purchaseHistory": true,
    "reports.salesHistory": true,
    "reports.salesReturnHistory": true,
    "reports.purchaseReturnHistory": true,
    "expense.voucher": true,
    "reports.expense": true,
    "accounting.entries": true,
    "accounting.customerBalance": true,
    "accounting.subLedgers": true,
    "accounting.trialBalance": true,
    "accounting.profitLoss": true,
    "accounting.balanceSheet": true,
    "accounting.chartOfAccounts": true,
    "accounting.manualJournal": true,
    "settings.company": false,
    "settings.users": false,
    "settings.roles": false,
    "settings.permissions": false,
  },
  staff: {
    dashboard: true,
    "master.product": true,
    "master.customer": true,
    "master.category": false,
    "master.uom": false,
    "master.priceLevel": false,
    "master.warehouse": false,
    "master.bank": false,
    "master.branch": false,
    "master.financialYear": false,
    "sales.invoice": true,
    "sales.return": false,
    "purchase.invoice": true,
    "purchase.return": false,
    "receipt.voucher": false,
    "payment.voucher": false,
    "reports.stock": true,
    "reports.sales": false,
    "reports.purchase": false,
    "reports.shop": false,
    "reports.purchaseHistory": false,
    "reports.salesHistory": false,
    "reports.salesReturnHistory": false,
    "reports.purchaseReturnHistory": false,
    "expense.voucher": false,
    "reports.expense": false,
    "accounting.entries": false,
    "accounting.customerBalance": false,
    "accounting.subLedgers": false,
    "accounting.trialBalance": false,
    "accounting.profitLoss": false,
    "accounting.balanceSheet": false,
    "accounting.chartOfAccounts": false,
    "accounting.manualJournal": false,
    "settings.company": false,
    "settings.users": false,
    "settings.roles": false,
    "settings.permissions": false,
  },
};

export const DEFAULT_ROLE_PERMISSIONS = Object.fromEntries(
  MANAGED_ROLES.map((role) => [
    role,
    role === "viewer"
      ? buildPermissionsFromViewMap(DEFAULT_ROLE_VIEW_ACCESS[role], { viewOnly: true })
      : buildCrudFromViewMap(DEFAULT_ROLE_VIEW_ACCESS[role]),
  ])
);

export const SUPER_ADMIN_SETTINGS = Object.fromEntries(
  ["settings.company", "settings.users", "settings.roles", "settings.permissions"].flatMap(
    (resourceKey) => PERMISSION_ACTIONS.map((action) => [actionKey(resourceKey, action), true])
  )
);

export const isSystemRole = (role) => MANAGED_ROLES.includes(role);

export const slugifyRoleName = (name = "") =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
