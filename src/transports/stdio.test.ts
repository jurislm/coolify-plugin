import { describe, expect, test } from "bun:test";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createStdioTransport } from "./stdio.js";

describe("createStdioTransport", () => {
  test("creates the SDK stdio transport", () => {
    expect(createStdioTransport()).toBeInstanceOf(StdioServerTransport);
  });
});
