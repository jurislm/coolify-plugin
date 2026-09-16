import { describe, expect, test } from "bun:test";
import { CoolifyApiError, CoolifyClient } from "./client.js";
import type { CoolifyConfig } from "./config.js";

const config: CoolifyConfig = { baseUrl: "https://coolify.example/api/v1", token: "secret-token", timeoutMs: 30_000 };
const operation = {
  name: "coolify_get_application",
  method: "GET",
  path: "/applications/{uuid}",
  parameters: [{ location: "path", name: "uuid" }, { location: "query", name: "tag" }],
  responseKind: "json",
};

describe("CoolifyClient", () => {
  test("returns a structured envelope with encoded requests", async () => {
    let request = "";
    const client = new CoolifyClient(config, async (url, init) => {
      request = String(url);
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer secret-token");
      return new Response(JSON.stringify({ uuid: "app" }), { headers: { "content-type": "application/json" } });
    });

    await expect(client.request(operation, { uuid: "app/a", tag: "production blue" })).resolves.toEqual({
      data: { uuid: "app" }, status: 200, request: { method: "GET", path: "/applications/app%2Fa" },
    });
    expect(request).toBe("https://coolify.example/api/v1/applications/app%2Fa?tag=production+blue");
  });

  test("redacts the token from request failures", async () => {
    const client = new CoolifyClient(config, async () => { throw new Error("secret-token failed"); });
    const error = await client.request(operation, { uuid: "app" }).catch((value) => value);
    expect(error).toBeInstanceOf(CoolifyApiError);
    expect(error.message).not.toContain("secret-token");
  });

  test("redacts successful nested environment and private-key values", async () => {
    const client = new CoolifyClient(config, async () => new Response(JSON.stringify({
      value: "env-secret", nested: { real_value: "actual", private_key: "pem", token: "token" }, keys: [{ client_secret: "secret" }],
    }), { headers: { "content-type": "application/json" } }));
    await expect(client.request(operation, { uuid: "app" })).resolves.toMatchObject({
      data: { value: "[REDACTED]", nested: { real_value: "[REDACTED]", private_key: "[REDACTED]", token: "[REDACTED]" }, keys: [{ client_secret: "[REDACTED]" }] },
    });
  });

  test("uses a timeout AbortSignal and never retries a mutation", async () => {
    let calls = 0;
    let signal: AbortSignal | undefined;
    const client = new CoolifyClient({ ...config, timeoutMs: 1 }, async (_url, init) => {
      calls++;
      signal = init?.signal as AbortSignal;
      await new Promise<void>((resolve) => signal?.addEventListener("abort", () => resolve(), { once: true }));
      throw signal?.reason;
    });
    await expect(client.request({ ...operation, method: "POST" }, { uuid: "app", body: {} })).rejects.toBeInstanceOf(CoolifyApiError);
    expect(signal?.aborted).toBe(true);
    expect(calls).toBe(1);
  });
});
