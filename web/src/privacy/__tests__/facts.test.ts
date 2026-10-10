import { expect, it } from "vitest";
import { privacyFacts, UNCONFIRMED } from "../facts";

it("プライバシーポリシーに、確かめていない値が残っていない", () => {
  expect(
    Object.entries(privacyFacts).filter(([, value]) => value === UNCONFIRMED),
  ).toEqual([]);
});
