import mongoose from "mongoose";

const stockLedgerSchema = new mongoose.Schema(
  {
    companyId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Company",
      required: true,
    },
    branchId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Branch",
      required: true,
    },
    financialYearId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "FinancialYear",
      required: true,
    },
    warehouseId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Warehouse",
      required: true,
    },
    itemId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Item",
      required: true,
    },

    // Movement type
    movementType: {
      type: String,
      enum: [
        "purchase_in",
        "purchase_return",
        "sales_out",
        "sales_return",
        "transfer_in",
        "transfer_out",
        "adjustment_in",
        "adjustment_out",
        "opening_stock",
      ],
      required: true,
    },

    // Quantity — always positive
    // direction determined by movementType
    qty:       { type: Number, required: true, min: 0 },
    rate:      { type: Number, default: 0 },  // cost/price at time of movement
    value:     { type: Number, default: 0 },  // qty * rate

    // Stock after this movement
    balanceQty: { type: Number, required: true },

    // Reference to source document
    referenceType: {
      type: String,
      enum: [
        "PurchaseInvoice",
        "PurchaseReturn",
        "SalesInvoice",
        "SalesReturn",
        "StockTransfer",
        "Adjustment",
        "Opening",
      ],
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    referenceNo: { type: String }, // "INV-001", "TRFR-001"

    // For transfers — link to other warehouse
    linkedWarehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  "Warehouse",
    },

    notes: { type: String },
  },
  {
    timestamps: true,
  }
);

// ── Indexes ───────────────────────────────────────────────────
stockLedgerSchema.index({ companyId: 1, warehouseId: 1, itemId: 1, financialYearId: 1 });
stockLedgerSchema.index({ companyId: 1, financialYearId: 1, movementType: 1 });
stockLedgerSchema.index({ companyId: 1, referenceId: 1 });
stockLedgerSchema.index({ createdAt: -1 });

export default mongoose.model("StockLedger", stockLedgerSchema);