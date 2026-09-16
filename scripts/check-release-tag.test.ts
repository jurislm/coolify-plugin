import { describe, expect, test } from "bun:test";
import { checkReleaseTag } from "./check-release-tag.js";

describe("checkReleaseTag", () => {
  test("requires CI_COMMIT_TAG to equal v plus package version", () => {
    expect(() => checkReleaseTag("0.1.0", "0.2.0")).toThrow(/v0\.1\.0/iu);
    expect(() => checkReleaseTag("0.1.0", "v0.1.0")).not.toThrow();
  });
});
