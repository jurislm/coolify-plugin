import { describe, expect, test } from "bun:test";
import { CoolifyClient } from "./client.js";
import type { CoolifyConfig } from "./config.js";
import { operations } from "./generated/operations.js";

const fixture = await Bun.file(new URL("./fixtures/jur-1023-env-partial-update.json", import.meta.url)).json() as {
  coolify_version: string;
  cases: Array<{
    response_status: number;
    request: { body: Record<string, unknown> };
    response: { value?: string | null; is_buildtime?: boolean };
    assertions: {
      request_omits_value?: boolean;
      value_preserved?: boolean;
      request_includes_empty_string_value?: boolean;
      readback_value_is_null?: boolean;
      value_updated?: boolean;
    };
  }>;
};

const config: CoolifyConfig = {
  baseUrl: "https://coolify.example/api/v1",
  token: "secret-token",
  timeoutMs: 30_000,
};

const single = operations.find((item) => item.name === "coolify_update_env_by_application_uuid");
const bulk = operations.find((item) => item.name === "coolify_update_envs_by_application_uuid");

describe("env partial update contract", () => {
  test("single update accepts is_buildtime without value and rejects missing key", () => {
    expect(single).toBeDefined();
    const omitValue = single?.inputSchema.safeParse({
      uuid: "app",
      body: { key: "SLINKY_JUR1023_SINGLE", is_buildtime: false },
    });
    expect(omitValue?.success).toBe(true);

    const emptyString = single?.inputSchema.safeParse({
      uuid: "app",
      body: { key: "SLINKY_JUR1023_SINGLE", value: "" },
    });
    expect(emptyString?.success).toBe(true);

    const missingKey = single?.inputSchema.safeParse({
      uuid: "app",
      body: { is_buildtime: false },
    });
    expect(missingKey?.success).toBe(false);

    const withValue = single?.inputSchema.safeParse({
      uuid: "app",
      body: { key: "SLINKY_JUR1023_SINGLE", value: "fake-single-value-updated", is_buildtime: false },
    });
    expect(withValue?.success).toBe(true);
  });

  test("bulk update accepts is_buildtime without value", () => {
    expect(bulk).toBeDefined();
    const omitValue = bulk?.inputSchema.safeParse({
      uuid: "app",
      body: { data: [{ key: "SLINKY_JUR1023_BULK", is_buildtime: false }] },
    });
    expect(omitValue?.success).toBe(true);

    const emptyString = bulk?.inputSchema.safeParse({
      uuid: "app",
      body: { data: [{ key: "SLINKY_JUR1023_BULK", value: "" }] },
    });
    expect(emptyString?.success).toBe(true);
  });

  test("client JSON body omits value when the field is absent and keeps empty string when sent", async () => {
    expect(single).toBeDefined();
    const bodies: unknown[] = [];
    const client = new CoolifyClient(config, async (_url, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify(fixture.cases[0].response), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    });

    await client.request(single!, {
      uuid: "app",
      body: { key: "SLINKY_JUR1023_SINGLE", is_buildtime: false },
    });
    expect(bodies[0]).toEqual({ key: "SLINKY_JUR1023_SINGLE", is_buildtime: false });
    expect(Object.prototype.hasOwnProperty.call(bodies[0], "value")).toBe(false);

    await client.request(single!, {
      uuid: "app",
      body: { key: "SLINKY_JUR1023_SINGLE", value: "" },
    });
    expect(bodies[1]).toEqual({ key: "SLINKY_JUR1023_SINGLE", value: "" });
    expect(Object.prototype.hasOwnProperty.call(bodies[1], "value")).toBe(true);
  });

  test("recorded Coolify 4.6.0 fixtures keep omit/empty/update distinctions", () => {
    expect(fixture.coolify_version).toBe("4.6.0");
    for (const item of fixture.cases) {
      expect(item.response_status).toBe(201);
      if (item.assertions.request_omits_value) {
        expect(Object.prototype.hasOwnProperty.call(item.request.body, "value")).toBe(false);
        if ("data" in item.request.body) {
          for (const entry of item.request.body.data as Array<Record<string, unknown>>) {
            expect(Object.prototype.hasOwnProperty.call(entry, "value")).toBe(false);
          }
        }
        expect(item.assertions.value_preserved).toBe(true);
        expect(item.response.is_buildtime).toBe(false);
      }
      if (item.assertions.request_includes_empty_string_value) {
        expect(item.request.body).toMatchObject({ value: "" });
        expect(item.assertions.readback_value_is_null).toBe(true);
        expect(item.response.value).toBeNull();
      }
      if (item.assertions.value_updated) {
        expect(item.response.value).toBe("fake-single-value-updated");
      }
    }
  });
});
