import { describe, expect, test } from "bun:test";
import { ConfigError, loadConfig } from "./config.js";

describe("loadConfig", () => {
  test("requires canonical Coolify credentials and normalizes the API root", () => {
    expect(() => loadConfig({})).toThrow(ConfigError);
    expect(() => loadConfig({ COOLIFY_URL: "https://coolify.example" })).toThrow(ConfigError);
    expect(loadConfig({
      COOLIFY_URL: "https://coolify.example/",
      COOLIFY_TOKEN: "secret",
    })).toEqual({
      baseUrl: "https://coolify.example/api/v1",
      token: "secret",
      timeoutMs: 30_000,
    });
  });

  test("does not accept legacy credential aliases", () => {
    expect(() => loadConfig({
      COOLIFY_BASE_URL: "https://coolify.example",
      COOLIFY_ACCESS_TOKEN: "secret",
    })).toThrow(ConfigError);
  });
});
