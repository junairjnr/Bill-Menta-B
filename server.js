// load .env FIRST before anything else
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { validateEnv } from "./utils/validateEnv.js";
validateEnv();

import app from "./app.js";
import { syncItemIndexes } from "./modules/masters/item/item.service.js";

const PORT = process.env.PORT || 8008;
const MONGO_URI = process.env.MONGO_URI;

// Connect to MongoDB first, then start server
const startServer = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ MongoDB connected");

    try {
      await syncItemIndexes();
      console.log("✅ Item indexes synced");
    } catch (error) {
      console.warn("⚠️ Item index sync skipped:", error.message);
    }

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error.message);
    process.exit(1); // stop the process if DB connection fails
  }
};

startServer();
