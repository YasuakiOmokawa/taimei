import { Exit, Schema } from "effect";
import { expect, it } from "vitest";
import { TeamOrSkillName } from "../team-or-skill-name";

const decode = Schema.decodeUnknownExit(TeamOrSkillName);

it("前後の空白を除く", () => {
  expect(decode("  開発  ")).toEqual(Exit.succeed("開発"));
});

it("空と空白だけは名前にならない", () => {
  expect(Exit.isFailure(decode(""))).toBe(true);
  expect(Exit.isFailure(decode("   "))).toBe(true);
});

it("前後の空白を除いて 50 文字までを受け付ける", () => {
  expect(Exit.isSuccess(decode(` ${"あ".repeat(50)} `))).toBe(true);
  expect(Exit.isFailure(decode(` ${"あ".repeat(51)} `))).toBe(true);
});
