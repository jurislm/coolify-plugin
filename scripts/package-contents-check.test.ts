import { describe, expect, test } from "bun:test";
import { assertPackedDistribution, parsePackedPaths, requiredPackedPaths } from "./package-contents-check.js";

describe("parsePackedPaths", () => {
  test("parses Bun package paths and preserves duplicate entries for validation", () => {
    expect(parsePackedPaths("bun pack v1.3.14\npacked 1.0KB package.json\npacked 313B api/manifest.json\n")).toEqual(["package.json", "api/manifest.json"]);
  });
});

describe("assertPackedDistribution", () => {
  const validPaths = [...requiredPackedPaths];

  test("accepts the required npm portable and Codex paths", () => {
    expect(() => assertPackedDistribution(validPaths)).not.toThrow();
  });

  test("rejects a pack that includes the Cursor Git marketplace tree", () => {
    expect(() => assertPackedDistribution([...validPaths, "plugins/cursor/mcp.json"])).toThrow(/Git marketplace path plugins\/cursor\/mcp\.json/);
  });

  test("rejects a pack that includes the Cursor marketplace manifest", () => {
    expect(() => assertPackedDistribution([...validPaths, ".cursor-plugin/marketplace.json"])).toThrow(/Git marketplace path \.cursor-plugin\/marketplace\.json/);
  });

  test("rejects a pack that includes the Codex agents marketplace tree", () => {
    expect(() => assertPackedDistribution([...validPaths, ".agents/plugins/marketplace.json"])).toThrow(/Git marketplace path \.agents\/plugins\/marketplace\.json/);
  });

  test("still rejects a missing required portable path", () => {
    expect(() => assertPackedDistribution(validPaths.filter((path) => path !== "mcp.json"))).toThrow(/package is missing mcp\.json/);
  });
});
