import { describe, expect, it } from "vitest";
import { db } from "../../db/client";
import { user } from "../../db/schema";

describe("E2E Drizzle Client", () => {
  it("db クライアントが存在する", () => {
    expect(db).toBeDefined();
  });

  it("user スキーマが定義されている", () => {
    expect(user).toBeDefined();
    expect(user.id).toBeDefined();
    expect(user.email).toBeDefined();
    expect(user.name).toBeDefined();
  });

  it("db.select() メソッドが存在する", () => {
    expect(typeof db.select).toBe("function");
  });

  it("db.insert() メソッドが存在する", () => {
    expect(typeof db.insert).toBe("function");
  });
});
