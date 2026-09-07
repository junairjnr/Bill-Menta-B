// import express from "express";
// import cors from "cors";
// import helmet from "helmet";
// import morgan from "morgan";

// import errorHandler from "./middlewares/errorHandler.js";

// // Import routes
// import authRoutes from "./modules/auth/auth.routes.js";
// import itemCategoryRoutes from "./modules/masters/itemCategory/itemCategory.routes.js";
// import itemRoutes from "./modules/masters/item/item.routes.js";
// import customerRoutes from "./modules/masters/customer/customer.routes.js";
// import uomRoutes from "./modules/masters/uom/uom.routes.js";

// const app = express();
// app.use(express.json()); // ← this line MUST exist in app.js

// // app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));

// // cors configuration for development (allow all origins)

// // const allowedOrigins = [
// //   "http://localhost:3000",
// //   "https://billing-app-f.vercel.app",
// // ];
// const allowedOrigins = [
//   "http://localhost:3000",
//   process.env.CLIENT_URL, // ← from Render env var
// ].filter(Boolean);

// app.use(
//   cors({
//     origin: (origin, callback) => {
//       if (!origin) return callback(null, true);
//       if (allowedOrigins.includes(origin)) {
//         callback(null, true);
//       } else {
//         callback(new Error(`CORS blocked: ${origin}`));
//       }
//     },
//     credentials: true,
//     methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
//     allowedHeaders: ["Content-Type", "Authorization"],
//   })
// );

// // app.options("*", cors());

// // Middlewares
// app.use(helmet());
// app.use(express.json());
// app.use(morgan("dev"));

// // Routes
// app.use("/api/auth", authRoutes);
// app.use("/api/masters/item-categories", itemCategoryRoutes);
// app.use("/api/masters/items", itemRoutes);
// app.use("/api/masters/customers", customerRoutes);
// app.use("/api/masters/uom", uomRoutes);

// // Global error handler (must be last)
// app.use(errorHandler);

// export default app;
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import errorHandler from "./middlewares/errorHandler.js";
import authRoutes from "./modules/auth/auth.routes.js";
import itemCategoryRoutes from "./modules/masters/itemCategory/itemCategory.routes.js";
import itemRoutes from "./modules/masters/item/item.routes.js";
import customerRoutes from "./modules/masters/customer/customer.routes.js";
import uomRoutes from "./modules/masters/uom/uom.routes.js";
import priceLevel from "./modules/masters/priceLevel/priceLevel.routes.js";
import branchRoutes from "./modules/branch/branch.routes.js";
import fyRoutes from "./modules/financialYear/financialYear.routes.js";
import userRoutes from "./modules/user/user.routes.js";
import companyRoutes from "./modules/company/company.routes.js";
import warehouseRoutes from "./modules/warehouse/warehouse.routes.js";
import purchaseRoutes from "./modules/purchase/purchaseInvoice/purchaseInvoice.routes.js";
import purchaseReturnRoutes from "./modules/purchase/purchaseReturn/purchaseReturn.routes.js";
import salesInvoiceRoutes from "./modules/sales/salesInvoice/salesInvoice.routes.js";
import salesReturnRoutes from "./modules/sales/salesReturn/salesReturn.routes.js";
import reportRoutes from "./modules/reports/report.routes.js";
import bankAccountRoutes from "./modules/masters/bank/bank.routes.js";
import receiptRoutes from "./modules/receipt-payment/receipt.routes.js";
import vendorPaymentRoutes from "./modules/receipt-payment/vendorPayment.routes.js";
import expenseRoutes from "./modules/expense/expense.routes.js";
import settingsRoutes from "./modules/settings/settings.routes.js";
import accountingRoutes from "./modules/accounting/accounting.routes.js";
import exportRoutes from "./modules/export/export.routes.js";
import documentNumberRoutes from "./modules/documentNumber/documentNumber.routes.js";
import uploadRoutes from "./modules/upload/upload.routes.js";
import * as rpCtrl from "./modules/receipt-payment/receiptPayment.controller.js";
import protect from "./middlewares/authHandler.js";
import fyScope from "./middlewares/fyScope.js";
import { apiRateLimiter } from "./middlewares/rateLimiter.js";
const app = express();

// ── 1. Allowed origins ────────────────────────────────────────
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "http://localhost:3005",
  "https://billing-app-f.vercel.app",
  process.env.CLIENT_URL,
].filter(Boolean);

// ── 2. CORS — must be first ───────────────────────────────────
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked: ${origin}`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-fy-id"],
  })
);

// ── 3. Preflight — must be before routes ──────────────────────
// app.options("*", cors());
app.options("/{*any}", cors());

// ── 4. Other middleware ───────────────────────────────────────
app.use(helmet());
app.use(express.json({ limit: "1mb" }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// ── 5. Routes ─────────────────────────────────────────────────
app.use("/api", apiRateLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/masters/item-categories", itemCategoryRoutes);
app.use("/api/masters/items", itemRoutes);
app.use("/api/masters/customers", customerRoutes);
app.use("/api/masters/uom", uomRoutes);
app.use("/api/masters/price-level", priceLevel);
app.use("/api/branches", branchRoutes);
app.use("/api/financial-years", fyRoutes);
app.use("/api/users", userRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/warehouses", warehouseRoutes);
app.use("/api/purchase/returns", purchaseReturnRoutes);
app.use("/api/purchase", purchaseRoutes);
app.use("/api/sales/returns", salesReturnRoutes);
app.use("/api/sales", salesInvoiceRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/bank-accounts", bankAccountRoutes);
app.use("/api/receipts", receiptRoutes);
app.use("/api/vendor-payments", vendorPaymentRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/accounting", accountingRoutes);
app.use("/api/export", exportRoutes);
app.use("/api/document-numbers", documentNumberRoutes);
app.use("/api/uploads", uploadRoutes);

app.get("/api/customers/:id/outstanding", protect, fyScope, rpCtrl.customerOutstanding);
app.get("/api/vendors/:id/outstanding", protect, fyScope, rpCtrl.vendorOutstanding);

// ── 6. Error handler — must be last ───────────────────────────
app.use(errorHandler);

export default app;
