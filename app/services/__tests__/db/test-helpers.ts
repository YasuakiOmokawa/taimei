import { factory } from "../factories";
import { testDb, withRollback, type TestDb } from "./test-db";
import { beforeEach } from "vitest";

/**
 * シーケンスリセットで ID の決定性を保証（test-user-1, test-user-2, ...）
 */
export function useFactoryReset() {
  beforeEach(() => {
    factory.resetSequence();
  });
}

export function getFactory(db: TestDb = testDb) {
  return factory(db);
}

export { withRollback, testDb, type TestDb };
