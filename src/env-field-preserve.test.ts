import { describe, expect, test } from "bun:test";

type EnvRow = Record<string, unknown>;

type FieldPreserveFixture = {
  coolify_version: string;
  recorded_at_taipei: string;
  docs: string;
  upstream_fix: string;
  production_env_uuid: string;
  preview_env_uuid: string;
  allowed_fake_value: string;
  patch: { method: string; body: Record<string, unknown>; response_status: number };
  before: { status: number; envs: EnvRow[] };
  after: { status: number; envs: EnvRow[] };
};

const fixture = await Bun.file(new URL("./fixtures/jur-1023-env-field-preserve.json", import.meta.url)).json() as FieldPreserveFixture;

const ALLOWED_VOLATILE_FIELDS = {
  updated_at: "Coolify 在成功 PATCH 後會刷新該列的伺服器時間戳，不代表業務欄位被覆寫",
} as const;

type FieldMismatch = { field: string; before: unknown; after: unknown };

function compareEnvRowsByFieldUnion(
  before: EnvRow,
  after: EnvRow,
  options: {
    expectedChanges?: Record<string, { from: unknown; to: unknown }>;
    allowedVolatileFields?: ReadonlySet<string>;
  } = {},
): FieldMismatch[] {
  const expectedChanges = options.expectedChanges ?? {};
  const allowedVolatileFields = options.allowedVolatileFields ?? new Set<string>();
  const fields = [...new Set([...Object.keys(before), ...Object.keys(after), ...Object.keys(expectedChanges)])].sort();
  const mismatches: FieldMismatch[] = [];

  for (const field of fields) {
    const beforeValue = before[field];
    const afterValue = after[field];
    const expected = expectedChanges[field];
    if (expected) {
      if (!Object.is(beforeValue, expected.from) || !Object.is(afterValue, expected.to)) {
        mismatches.push({ field, before: beforeValue, after: afterValue });
      }
      continue;
    }
    if (allowedVolatileFields.has(field)) continue;
    if (!Object.is(beforeValue, afterValue)) {
      mismatches.push({ field, before: beforeValue, after: afterValue });
    }
  }
  return mismatches;
}

function rowByUuid(rows: EnvRow[], uuid: string): EnvRow {
  const row = rows.find((item) => item.uuid === uuid);
  if (!row) throw new Error(`fixture 缺少 uuid=${uuid} 的 env 紀錄`);
  return row;
}

const volatile = new Set(Object.keys(ALLOWED_VOLATILE_FIELDS));

describe("application env 局部更新欄位保留（JUR-1023 驗收第 2 項）", () => {
  test("fixture 來自 Coolify 4.6.0 真實錄製，PATCH body 只有 key 與 is_buildtime", () => {
    expect(fixture.coolify_version).toBe("4.6.0");
    expect(fixture.recorded_at_taipei.length).toBeGreaterThan(0);
    expect(fixture.docs).toBe("https://coolify.io/docs/api/endpoints/applications/update-env-by-application-uuid");
    expect(fixture.upstream_fix).toBe("https://github.com/coollabsio/coolify/pull/12240");
    expect(fixture.patch.method).toBe("PATCH");
    expect(fixture.patch.body).toEqual({ key: "SLINKY_JUR1023_FIELDS", is_buildtime: false });
    expect(Object.keys(fixture.patch.body).sort()).toEqual(["is_buildtime", "key"]);
    expect(fixture.patch.response_status).toBe(201);
    expect(fixture.before.status).toBe(200);
    expect(fixture.after.status).toBe(200);
    expect(fixture.before.envs).toHaveLength(2);
    expect(fixture.after.envs).toHaveLength(2);
  });

  test("正式那筆：除 is_buildtime（true→false）與明列伺服器時間欄位外，欄位聯集逐一相等", () => {
    const before = rowByUuid(fixture.before.envs, fixture.production_env_uuid);
    const after = rowByUuid(fixture.after.envs, fixture.production_env_uuid);
    expect(before.is_preview).toBe(false);
    expect(after.is_preview).toBe(false);
    expect(before.value).toBe(fixture.allowed_fake_value);
    expect(after.value).toBe(fixture.allowed_fake_value);
    expect(compareEnvRowsByFieldUnion(before, after, {
      expectedChanges: { is_buildtime: { from: true, to: false } },
      allowedVolatileFields: volatile,
    })).toEqual([]);
    for (const reason of Object.values(ALLOWED_VOLATILE_FIELDS)) {
      expect(reason.length).toBeGreaterThan(0);
    }
  });

  test("預覽那筆：所有欄位（含 updated_at，is_buildtime 仍為 true）完全不變", () => {
    const before = rowByUuid(fixture.before.envs, fixture.preview_env_uuid);
    const after = rowByUuid(fixture.after.envs, fixture.preview_env_uuid);
    expect(before.is_preview).toBe(true);
    expect(after.is_preview).toBe(true);
    expect(before.is_buildtime).toBe(true);
    expect(after.is_buildtime).toBe(true);
    expect(compareEnvRowsByFieldUnion(before, after)).toEqual([]);
  });

  test("比對函式會抓出非目標欄位被改壞（改 value 應失敗）", () => {
    const before = rowByUuid(fixture.before.envs, fixture.production_env_uuid);
    const after = { ...rowByUuid(fixture.after.envs, fixture.production_env_uuid), value: "tampered-should-fail" };
    const mismatches = compareEnvRowsByFieldUnion(before, after, {
      expectedChanges: { is_buildtime: { from: true, to: false } },
      allowedVolatileFields: volatile,
    });
    expect(mismatches.some((item) => item.field === "value")).toBe(true);
  });

  test("比對函式會抓出預覽列非目標欄位被改壞（改 is_preview 應失敗）", () => {
    const before = rowByUuid(fixture.before.envs, fixture.preview_env_uuid);
    const after = { ...rowByUuid(fixture.after.envs, fixture.preview_env_uuid), is_preview: false };
    expect(compareEnvRowsByFieldUnion(before, after)).toEqual([
      { field: "is_preview", before: true, after: false },
    ]);
  });

  test("比對函式會抓出預覽列 updated_at 被刷新（預覽列不得被 PATCH 碰到）", () => {
    const before = rowByUuid(fixture.before.envs, fixture.preview_env_uuid);
    const after = { ...rowByUuid(fixture.after.envs, fixture.preview_env_uuid), updated_at: "2099-01-01T00:00:00.000000Z" };
    expect(compareEnvRowsByFieldUnion(before, after).map((item) => item.field)).toEqual(["updated_at"]);
  });

  test("比對函式會抓出目標欄位在前後快照都缺漏（is_buildtime 不見應失敗）", () => {
    const before = { ...rowByUuid(fixture.before.envs, fixture.production_env_uuid) };
    const after = { ...rowByUuid(fixture.after.envs, fixture.production_env_uuid) };
    delete before.is_buildtime;
    delete after.is_buildtime;
    const mismatches = compareEnvRowsByFieldUnion(before, after, {
      expectedChanges: { is_buildtime: { from: true, to: false } },
      allowedVolatileFields: volatile,
    });
    expect(mismatches).toEqual([{ field: "is_buildtime", before: undefined, after: undefined }]);
  });
});
