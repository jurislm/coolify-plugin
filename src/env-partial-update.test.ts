import { describe, expect, test } from "bun:test";
import { CoolifyClient } from "./client.js";
import type { CoolifyConfig } from "./config.js";
import { operations } from "./generated/operations.js";

type EnvRecord = { value?: string | null; is_buildtime?: boolean; key?: string };
const fixture = await Bun.file(new URL("./fixtures/jur-1023-env-partial-update.json", import.meta.url)).json() as {
  coolify_version: string;
  cases: Array<{
    name: string;
    response_status: number;
    request: { body: Record<string, unknown> };
    response: EnvRecord | EnvRecord[];
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

function primary(response: EnvRecord | EnvRecord[]): EnvRecord {
  return Array.isArray(response) ? response[0]! : response;
}

describe("環境變數局部更新契約", () => {
  test("單筆更新可只送 is_buildtime、省略 value，且缺 key 時拒絕", () => {
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

  test("批次更新可只送 is_buildtime、省略 value，且缺 key 時拒絕", () => {
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

    const missingKey = bulk?.inputSchema.safeParse({
      uuid: "app",
      body: { data: [{ is_buildtime: false }] },
    });
    expect(missingKey?.success).toBe(false);

    for (const name of [
      "coolify_update_envs_by_database_uuid",
      "coolify_update_envs_by_service_uuid",
    ]) {
      const operation = operations.find((item) => item.name === name);
      expect(operation).toBeDefined();
      expect(operation?.inputSchema.safeParse({
        uuid: "resource",
        body: { data: [{ is_literal: false }] },
      }).success).toBe(false);
      expect(operation?.inputSchema.safeParse({
        uuid: "resource",
        body: { data: [{ key: "SLINKY_JUR1023_BULK" }] },
      }).success).toBe(true);
    }
  });

  test("database／service env 契約不暴露 Coolify 未支援的 is_buildtime", () => {
    for (const name of [
      "coolify_update_env_by_database_uuid",
      "coolify_update_env_by_service_uuid",
      "coolify_update_envs_by_database_uuid",
      "coolify_update_envs_by_service_uuid",
    ]) {
      const operation = operations.find((item) => item.name === name);
      expect(operation).toBeDefined();
      const serialized = JSON.stringify(operation?.inputSchema);
      expect(serialized.includes("is_buildtime")).toBe(false);
    }
  });

  test("客戶端 JSON body 在省略欄位時不含 value，送空字串時則保留 value 鍵", async () => {
    expect(single).toBeDefined();
    expect(bulk).toBeDefined();
    const bodies: unknown[] = [];
    let outboundCount = 0;
    const client = new CoolifyClient(config, async (_url, init) => {
      outboundCount += 1;
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

    await client.request(bulk!, {
      uuid: "app",
      body: { data: [{ key: "SLINKY_JUR1023_BULK", is_buildtime: false }] },
    });
    expect(bodies[2]).toEqual({ data: [{ key: "SLINKY_JUR1023_BULK", is_buildtime: false }] });
    expect(Object.prototype.hasOwnProperty.call((bodies[2] as { data: Array<Record<string, unknown>> }).data[0], "value")).toBe(false);

    expect(bulk?.inputSchema.safeParse({
      uuid: "app",
      body: { data: [{ is_buildtime: false }] },
    }).success).toBe(false);
    expect(outboundCount).toBe(3);
  });

  test("錄製的 Coolify 4.6.0 fixture 區分省略、空字串與明確更新", () => {
    expect(fixture.coolify_version).toBe("4.6.0");
    for (const item of fixture.cases) {
      expect(item.response_status).toBe(201);
      const response = primary(item.response);
      if (item.name.startsWith("bulk_")) {
        expect(Array.isArray(item.response)).toBe(true);
        expect(bulk?.responseSchema.safeParse(item.response).success).toBe(true);
      } else {
        expect(single?.responseSchema.safeParse(item.response).success).toBe(true);
      }
      if (item.assertions.request_omits_value) {
        expect(Object.prototype.hasOwnProperty.call(item.request.body, "value")).toBe(false);
        if ("data" in item.request.body) {
          for (const entry of item.request.body.data as Array<Record<string, unknown>>) {
            expect(Object.prototype.hasOwnProperty.call(entry, "value")).toBe(false);
          }
        }
        expect(item.assertions.value_preserved).toBe(true);
        expect(response.is_buildtime).toBe(false);
      }
      if (item.assertions.request_includes_empty_string_value) {
        expect(item.request.body).toMatchObject({ value: "" });
        expect(item.assertions.readback_value_is_null).toBe(true);
        expect(response.value).toBeNull();
      }
      if (item.assertions.value_updated) {
        expect(response.value).toBe("fake-single-value-updated");
      }
    }
  });
});
