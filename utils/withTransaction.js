import mongoose from "mongoose";

const TRANSACTION_UNSUPPORTED =
  /Transaction numbers are only allowed|replica set|multi-document transaction/i;

/**
 * Runs work inside a MongoDB transaction when supported (replica set).
 * Falls back to running without a session on standalone/local MongoDB.
 */
export async function withTransaction(work) {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();
    const result = await work(session);
    await session.commitTransaction();
    return result;
  } catch (err) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    if (TRANSACTION_UNSUPPORTED.test(err.message || "")) {
      return work(null);
    }

    throw err;
  } finally {
    session.endSession();
  }
}

export const sessionOpts = (session) => (session ? { session } : undefined);
