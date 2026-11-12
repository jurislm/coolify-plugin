#!/usr/bin/env bun

const APPLICATION_UUID = "pr7ekxom79afswxw8a6fdsrg";
const TARGET_KEY = "SLINKY_JUR1023_FIELDS";
const ALLOWED_VALUE = "fake-jur1023-keep-me";
const PRODUCTION_ENV_UUID = "suqqyeaj9qsgnfgtadmo5x0n";
const PREVIEW_ENV_UUID = "vd0siivi6v6kjcq4zy3viwfj";
const OUT_PATH = new URL("../src/fixtures/jur-1023-env-field-preserve.json", import.meta.url);

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`缺少環境變數 ${name}`);
  return value;
}

function apiRoot(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/u, "");
  return trimmed.endsWith("/api/v1") ? trimmed : `${trimmed}/api/v1`;
}

function taipeiStamp(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")} +0800`;
}

function assertSafeValue(value: unknown, context: string): void {
  if (value == null) return;
  if (typeof value !== "string" || value !== ALLOWED_VALUE) {
    throw new Error(`${context} 出現非測試假值或非字串，已中止寫入 fixture`);
  }
}

function sanitizeEnvList(rows: Json, label: string): Record<string, Json>[] {
  if (!Array.isArray(rows)) throw new Error(`${label} 不是陣列`);
  return rows.map((row, index) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw new Error(`${label}[${index}] 不是物件`);
    }
    const out = { ...(row as Record<string, Json>) };
    assertSafeValue(out.value, `${label}[${index}].value`);
    assertSafeValue(out.real_value, `${label}[${index}].real_value`);
    return out;
  });
}

async function coolifyFetch(
  root: string,
  token: string,
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<{ status: number; json: Json }> {
  const response = await fetch(`${root}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json: Json = null;
  if (text.length > 0) {
    try {
      json = JSON.parse(text) as Json;
    } catch {
      json = text.trim();
    }
  }
  return { status: response.status, json };
}

function summarize(rows: Record<string, Json>[]) {
  return rows.map((row) => ({
    uuid: row.uuid ?? null,
    key: row.key ?? null,
    is_preview: row.is_preview ?? null,
    is_buildtime: row.is_buildtime ?? null,
    value_is_allowed_fake: row.value === ALLOWED_VALUE,
  }));
}

async function main(): Promise<void> {
  const root = apiRoot(requireEnv("COOLIFY_BASE_URL"));
  const token = requireEnv("COOLIFY_ACCESS_TOKEN");
  const patchBody = { key: TARGET_KEY, is_buildtime: false };

  console.log("錄製開始（不印出 token）");
  console.log(`application=${APPLICATION_UUID} key=${TARGET_KEY}`);
  console.log(`patch_body_keys=${Object.keys(patchBody).sort().join(",")}`);

  const version = await coolifyFetch(root, token, "GET", "/version");
  if (version.status !== 200) throw new Error(`GET /version 失敗：status ${version.status}`);
  const coolifyVersion =
    typeof version.json === "object" && version.json && !Array.isArray(version.json) && typeof version.json.version === "string"
      ? version.json.version
      : typeof version.json === "string"
        ? version.json
        : JSON.stringify(version.json);

  const before = await coolifyFetch(root, token, "GET", `/applications/${APPLICATION_UUID}/envs`);
  if (before.status !== 200) throw new Error(`更新前 GET envs 失敗：status ${before.status}`);
  const beforeRows = sanitizeEnvList(before.json, "before");

  const patch = await coolifyFetch(root, token, "PATCH", `/applications/${APPLICATION_UUID}/envs`, patchBody);
  if (patch.status < 200 || patch.status >= 300) throw new Error(`PATCH envs 失敗：status ${patch.status}`);

  const after = await coolifyFetch(root, token, "GET", `/applications/${APPLICATION_UUID}/envs`);
  if (after.status !== 200) throw new Error(`更新後 GET envs 失敗：status ${after.status}`);
  const afterRows = sanitizeEnvList(after.json, "after");

  const has = (rows: Record<string, Json>[], uuid: string) => rows.some((row) => row.uuid === uuid);
  if (!has(beforeRows, PRODUCTION_ENV_UUID) || !has(afterRows, PRODUCTION_ENV_UUID)) {
    throw new Error("正式 env uuid 在更新前後快照中找不到");
  }
  if (!has(beforeRows, PREVIEW_ENV_UUID) || !has(afterRows, PREVIEW_ENV_UUID)) {
    throw new Error("預覽 env uuid 在更新前後快照中找不到");
  }

  const fixture = {
    coolify_version: coolifyVersion,
    recorded_at_taipei: taipeiStamp(),
    docs: "https://coolify.io/docs/api/endpoints/applications/update-env-by-application-uuid",
    upstream_fix: "https://github.com/coollabsio/coolify/pull/12240",
    application_uuid: APPLICATION_UUID,
    target_key: TARGET_KEY,
    production_env_uuid: PRODUCTION_ENV_UUID,
    preview_env_uuid: PREVIEW_ENV_UUID,
    allowed_fake_value: ALLOWED_VALUE,
    patch: {
      method: "PATCH",
      path: `/applications/${APPLICATION_UUID}/envs`,
      body: patchBody,
      response_status: patch.status,
      response: patch.json,
    },
    before: { status: before.status, envs: beforeRows },
    after: { status: after.status, envs: afterRows },
  };

  await Bun.write(OUT_PATH, `${JSON.stringify(fixture, null, 2)}\n`);
  console.log(`coolify_version=${coolifyVersion}`);
  console.log(`recorded_at_taipei=${fixture.recorded_at_taipei}`);
  console.log(`patch_status=${patch.status}`);
  console.log("before_summary=", JSON.stringify(summarize(beforeRows)));
  console.log("after_summary=", JSON.stringify(summarize(afterRows)));
  console.log(`fixture_written=${OUT_PATH.pathname}`);
  console.log("錄製完成：未還原、未第二次 PATCH");
}

await main();
