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
  test("preserves binary base64 bytes", async () => {
    const client = new CoolifyClient(config, async () => new Response(new Uint8Array([65]), { headers: { "content-type": "application/octet-stream" } }));
    await expect(client.request(operation, { uuid: "app" })).resolves.toEqual({
      data: { encoding: "base64", contentType: "application/octet-stream", value: "QQ==" }, status: 200, request: { method: "GET", path: "/applications/app" },
    });
  });
  test("allows public health without a credential while protecting other endpoints", async () => {
    const requests: string[] = [];
    const client = new CoolifyClient({ baseUrl: config.baseUrl, timeoutMs: 30_000 }, async (url, init) => {
      requests.push(new URL(String(url)).pathname);
      expect(new Headers(init?.headers).get("authorization")).toBeNull();
      return new Response("OK", { headers: { "content-type": "text/plain" } });
    });
    await expect(client.request({ method: "GET", path: "/health", parameters: [] }, {})).resolves.toMatchObject({ data: "OK", status: 200 });
    await expect(client.request(operation, { uuid: "app" })).rejects.toThrow("COOLIFY_ACCESS_TOKEN is required");
    expect(requests).toEqual(["/api/v1/health"]);
  });

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

  test("reports validation field names without leaking response values", async () => {
    const client = new CoolifyClient(config, async () => new Response(JSON.stringify({
      message: "secret-token is invalid",
      errors: { environment_uuid: ["secret-token is invalid"] },
    }), { status: 422, headers: { "content-type": "application/json" } }));
    const error = await client.request(operation, { uuid: "app" }).catch((value) => value);
    expect(error).toBeInstanceOf(CoolifyApiError);
    expect(error.message).toContain("environment_uuid");
    expect(error.message).not.toContain("secret-token");
  });

  test("returns environment values verbatim, including is_shown_once values", async () => {
    const envs = [
      { key: "DB_PASSWORD", value: "fake-env-pass", real_value: "fake-env-pass", is_shown_once: true },
      { key: "DATABASE_URL", value: "postgres://app:fake-url-pass@db:5432/app?password=fake-query-pass", real_value: "postgres://app:fake-url-pass@db:5432/app?password=fake-query-pass", is_shown_once: false },
    ];
    const client = new CoolifyClient(config, async () => new Response(JSON.stringify(envs), { headers: { "content-type": "application/json" } }));
    await expect(client.request(operation, { uuid: "app" })).resolves.toMatchObject({ data: envs });
  });

  test("redacts the access token even inside environment values", async () => {
    const client = new CoolifyClient(config, async () => new Response(JSON.stringify([
      { key: "COOLIFY_ACCESS_TOKEN", value: "secret-token", real_value: "Bearer secret-token", is_shown_once: true },
    ]), { headers: { "content-type": "application/json" } }));
    const result = await client.request(operation, { uuid: "app" });
    expect(result).toMatchObject({ data: [{ key: "COOLIFY_ACCESS_TOKEN", value: "[REDACTED]", real_value: "Bearer [REDACTED]" }] });
    expect(JSON.stringify(result)).not.toContain("secret-token");
  });

  test("still redacts value fields outside environment variable records", async () => {
    const client = new CoolifyClient(config, async () => new Response(JSON.stringify({
      value: "https://user:fake-plain-pass@host/?token=fake-plain-token", real_value: "fake-plain-real", labels: [{ key: "LABEL", value: "fake-label-value" }],
    }), { headers: { "content-type": "application/json" } }));
    await expect(client.request(operation, { uuid: "app" })).resolves.toMatchObject({
      data: { value: "[REDACTED]", real_value: "[REDACTED]", labels: [{ key: "LABEL", value: "[REDACTED]" }] },
    });
  });

  test("still redacts credential fields and URL credentials outside environment values", async () => {
    const client = new CoolifyClient(config, async () => new Response(JSON.stringify({
      nested: { private_key: "fake-pem", token: "fake-token", authorization: "Bearer fake-bearer", cookie: "session=fake-cookie", discord_webhook_url: "fake-url", resend_api_key: "fake-key", password: "fake-pass" },
      keys: [{ client_secret: "fake-secret" }],
      git_repository: "https://deployer:fake-git-pass@git.example/repo.git?access_token=fake-git-query",
    }), { headers: { "content-type": "application/json" } }));
    const result = await client.request(operation, { uuid: "app" });
    expect(result).toMatchObject({
      data: {
        nested: { private_key: "[REDACTED]", token: "[REDACTED]", authorization: "[REDACTED]", cookie: "[REDACTED]", discord_webhook_url: "[REDACTED]", resend_api_key: "[REDACTED]", password: "[REDACTED]" },
        keys: [{ client_secret: "[REDACTED]" }],
        git_repository: "https://deployer:[REDACTED]@git.example/repo.git?access_token=[REDACTED]",
      },
    });
    for (const secret of ["fake-pem", "fake-token", "fake-bearer", "fake-cookie", "fake-url", "fake-key", "fake-pass", "fake-secret", "fake-git-pass", "fake-git-query"]) expect(JSON.stringify(result)).not.toContain(secret);
  });

  test("encodes plain Dockerfile content for Coolify", async () => {
    let body: Record<string, unknown> = {};
    const client = new CoolifyClient(config, async (_url, init) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({ uuid: "app" }), { status: 201, headers: { "content-type": "application/json" } });
    });
    await client.request({ method: "POST", path: "/applications/dockerfile", parameters: [] }, { body: { dockerfile: "FROM nginx:alpine", name: "qa" } });
    expect(body).toEqual({ dockerfile: "RlJPTSBuZ2lueDphbHBpbmU=", name: "qa" });
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
