import { describe, expect, test } from "bun:test";
import { ConfigError, loadConfig } from "./config.js";

describe("loadConfig", () => {
  test("defers missing credentials and normalizes a configured API root", () => {
    expect(loadConfig({})).toEqual({ timeoutMs: 30_000 });
    expect(loadConfig({ COOLIFY_BASE_URL: "https://coolify.example" })).toEqual({
      baseUrl: "https://coolify.example/api/v1",
      timeoutMs: 30_000,
    });
    expect(loadConfig({
      COOLIFY_BASE_URL: "https://coolify.example/",
      COOLIFY_ACCESS_TOKEN: "secret",
    })).toEqual({
      baseUrl: "https://coolify.example/api/v1",
      token: "secret",
      timeoutMs: 30_000,
    });
    expect(() => loadConfig({ COOLIFY_BASE_URL: "not-a-url" })).toThrow(ConfigError);
  });

  test("does not accept plugin-local credential names", () => {
    expect(loadConfig({
      COOLIFY_URL: "https://coolify.example",
      COOLIFY_TOKEN: "secret",
    })).toEqual({ timeoutMs: 30_000 });
  });

  test("uses Cloud overrides, then Cursor Configure, then inherited credentials without mixing pairs", () => {
    expect(loadConfig({
      COOLIFY_CLOUD_BASE_URL: "https://cloud.example",
      COOLIFY_CLOUD_ACCESS_TOKEN: "cloud-token",
      COOLIFY_BASE_URL: "${COOLIFY_BASE_URL}",
      COOLIFY_ACCESS_TOKEN: "${COOLIFY_ACCESS_TOKEN}",
      CURSOR_COOLIFY_BASE_URL: "https://local.example",
      CURSOR_COOLIFY_ACCESS_TOKEN: "local-token",
    })).toEqual({ baseUrl: "https://cloud.example/api/v1", token: "cloud-token", timeoutMs: 30_000 });
    expect(loadConfig({
      COOLIFY_CLOUD_BASE_URL: "https://cloud.example",
      COOLIFY_BASE_URL: "https://canonical.example",
      COOLIFY_ACCESS_TOKEN: "canonical-token",
    })).toEqual({ baseUrl: "https://cloud.example/api/v1", timeoutMs: 30_000 });
    expect(loadConfig({
      COOLIFY_BASE_URL: "https://cloud.example",
      COOLIFY_ACCESS_TOKEN: "cloud-token",
      CURSOR_COOLIFY_BASE_URL: "https://local.example",
      CURSOR_COOLIFY_ACCESS_TOKEN: "local-token",
    })).toEqual({ baseUrl: "https://local.example/api/v1", token: "local-token", timeoutMs: 30_000 });
    expect(loadConfig({
      CURSOR_COOLIFY_BASE_URL: "https://local.example",
      CURSOR_COOLIFY_ACCESS_TOKEN: "local-token",
    })).toEqual({ baseUrl: "https://local.example/api/v1", token: "local-token", timeoutMs: 30_000 });
    expect(loadConfig({
      CURSOR_COOLIFY_BASE_URL: "${COOLIFY_BASE_URL}",
      CURSOR_COOLIFY_ACCESS_TOKEN: "${COOLIFY_ACCESS_TOKEN}",
    })).toEqual({ timeoutMs: 30_000 });
    expect(loadConfig({
      CURSOR_COOLIFY_BASE_URL: "${CURSOR_COOLIFY_BASE_URL}",
      CURSOR_COOLIFY_ACCESS_TOKEN: "${CURSOR_COOLIFY_ACCESS_TOKEN}",
    })).toEqual({ timeoutMs: 30_000 });
    expect(loadConfig({
      COOLIFY_BASE_URL: "${COOLIFY_BASE_URL}",
      COOLIFY_ACCESS_TOKEN: "${COOLIFY_ACCESS_TOKEN}",
      CURSOR_COOLIFY_BASE_URL: "https://local.example",
      CURSOR_COOLIFY_ACCESS_TOKEN: "local-token",
    })).toEqual({ baseUrl: "https://local.example/api/v1", token: "local-token", timeoutMs: 30_000 });
    expect(loadConfig({
      COOLIFY_BASE_URL: "https://cloud.example",
      CURSOR_COOLIFY_ACCESS_TOKEN: "local-token",
    })).toEqual({ token: "local-token", timeoutMs: 30_000 });
    expect(loadConfig({
      COOLIFY_ACCESS_TOKEN: "cloud-token",
      CURSOR_COOLIFY_BASE_URL: "https://local.example",
    })).toEqual({ baseUrl: "https://local.example/api/v1", timeoutMs: 30_000 });
  });
});
