import { describe, expect, test } from "bun:test";
import { parseServerSentEvents } from "./stream.js";

describe("parseServerSentEvents", () => {
  test("parses JSON and text data frames while ignoring comments", () => {
    expect(parseServerSentEvents(": keep-alive\ndata: {\"id\":1}\n\ndata: ready\n\n")).toEqual([{ id: 1 }, "ready"]);
  });
});
