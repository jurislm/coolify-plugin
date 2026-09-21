import { describe, expect, test } from "bun:test";
import { ConfigError, loadConfig } from "./config.js";

describe("loadConfig", () => {
  test("defers missing credentials and normalizes a configured API root", () => {
    expect(loadConfig({})).toEqual({ timeoutMs: 30_000 });
    expect(loadConfig({ COOLIFY_URL: "https://coolify.example" })).toEqual({
      baseUrl: "https://coolify.example/api/v1",
      timeoutMs: 30_000,
    });
    expect(loadConfig({
      COOLIFY_URL: "https://coolify.example/",
      COOLIFY_TOKEN: "secret",
    })).toEqual({
      baseUrl: "https://coolify.example/api/v1",
      token: "secret",
      timeoutMs: 30_000,
    });
    expect(() => loadConfig({ COOLIFY_URL: "not-a-url" })).toThrow(ConfigError);
  });

  test("does not accept legacy credential aliases", () => {
    expect(loadConfig({
      COOLIFY_BASE_URL: "https://coolify.example",
      COOLIFY_ACCESS_TOKEN: "secret",
    })).toEqual({ timeoutMs: 30_000 });
  });
});
