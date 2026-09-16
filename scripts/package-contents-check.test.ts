import { describe, expect, test } from "bun:test";
import { parsePackedPaths } from "./package-contents-check.js";

describe("parsePackedPaths", () => {
  test("parses Bun package paths and preserves duplicate entries for validation", () => {
    expect(parsePackedPaths("bun pack v1.3.14\npacked 1.0KB package.json\npacked 313B api/manifest.json\n")).toEqual(["package.json", "api/manifest.json"]);
  });
});
