import type { StorageProvider } from "@rxwf/providers-contracts";

const notImplemented = async () => {
  throw new Error("Lite StorageProvider not implemented");
};

/** Placeholder for apps/api wiring in later tasks. */
export function createLiteStorageProvider(): StorageProvider {
  const stub = { findById: notImplemented, findSessionById: notImplemented };
  return {
    workflows: stub,
    executions: stub,
    credentials: stub,
    users: stub,
    chat: stub,
  };
}
