import { describe, expect, test } from "bun:test";
import { checkReleaseTag } from "./check-release-tag.js";

describe("checkReleaseTag", () => {
  test("requires CI_COMMIT_TAG to equal v plus package version", () => {
    expect(() => checkReleaseTag("3.6.0", "3.7.0")).toThrow(/v3\.6\.0/iu);
    expect(() => checkReleaseTag("3.6.0", "v3.6.0")).not.toThrow();
  });
});
