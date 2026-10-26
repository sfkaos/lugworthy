import { describe, expect, it } from "vitest";
import { isUnreachable } from "../scripts/migrate";

describe("migrate before build", () => {
  it("lets the build go on when the database is unreachable or over quota", () => {
    expect(isUnreachable({ message: "Failed query", cause: { code: "53000", message: "Your account or project has exceeded the quota" } })).toBe(true);
    expect(isUnreachable({ code: "ECONNREFUSED" })).toBe(true);
    expect(isUnreachable({ code: "08006" })).toBe(true);
  });
  it("still fails on real migration errors", () => {
    expect(isUnreachable({ message: "Failed query", cause: { code: "42P07", message: "relation already exists" } })).toBe(false);
    expect(isUnreachable(new Error("syntax"))).toBe(false);
  });
});
