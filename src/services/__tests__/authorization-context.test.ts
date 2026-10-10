import { expect, it } from "vitest";
import { isManager } from "../authorization-context";

it("OWNER と ADMIN は管理者", () => {
  expect(isManager("OWNER")).toBe(true);
  expect(isManager("ADMIN")).toBe(true);
});

it("MEMBER と、SDK が role を返さない人は管理者でない", () => {
  expect(isManager("MEMBER")).toBe(false);
  expect(isManager(undefined)).toBe(false);
});
