## Context

`diagnose_app` 是 v2.0.0 整併出的 composite tool，內部用 `Promise.allSettled` 平行收集 application、logs、env vars、deployments 四個來源（`src/client.ts:1705-1710`），任一失敗不影響其他。但 deployments 這條路徑在 settled / fulfilled 時，回傳值未經 shape 驗證就直接被當成 `Deployment[]` 呼叫 `.slice()`（line 1750），造成整個 `diagnoseApplication` 拋例外、整支工具不可用。

目前 client 對 `/deployments/applications/{uuid}` 只用 TypeScript 斷言 `request<Deployment[]>`（line 1089）— TypeScript 斷言只在編譯期；runtime 的 `request()` 直接 `JSON.parse` 後 cast 出去，沒有驗證。

issue 提交者環境是自架 Coolify + Traefik 3.6.14；但同一 client 其他 endpoint（`get_application`, `list_applications`, `list_databases`, `projects`）都正常，代表問題只出在 deployments。Coolify OpenAPI 雖宣稱 `type: array`（`openapi/coolify-openapi.json:4203`），active plugin documentation 已警示 OpenAPI 不可靠，必須以實機為準。

## Goals / Non-Goals

**Goals:**

- 讓 `diagnose_app` 在任何 Coolify 版本回傳的 deployments shape 下都能完成診斷，不因 deployments 異常而整個失敗。
- 在 client 層歸一化 deployments shape，所有現有 / 未來 caller 都受益，不在 caller 散落 patch。
- 用 runtime type guard 取代盲目斷言，符合 typescript/coding-style.md 對 `unknown` 的要求。
- 保持 `Promise<Deployment[]>` 公開簽章，避免 breaking change。
- 補 unit + integration smoke test，預防 regression。

**Non-Goals:**

- 重寫 `request<T>()` 加入全域 schema 驗證（範圍過大，留待後續 change）。
- 為其他 list endpoint 加同樣 guard（雖風險類似但無證據觸發，避免過度工程化）。
- 引入 zod schema 全面驗證 Coolify response（同上，範圍過大）。
- 修改 `diagnose_app` 的 MCP tool schema 或對外介面。

## Decisions

### Decision 1：修在 client 層而非 caller 層

**選擇**：把 shape 歸一化邏輯放進 `listApplicationDeployments`，而非 `diagnoseApplication`。

**理由**：

- 單一責任 — 「把 API response 轉成 array」是 client 的職責，不是 diagnostics 的職責。
- 所有 caller（現在 / 未來）都受益。
- `diagnoseApplication` 的 `extract()` + `Promise.allSettled` 邏輯保持乾淨。

**替代方案**：在 `diagnoseApplication` 直接用 `Array.isArray(deployments) ? ... : ...`（issue hypothesis 提的方案）。
**否決理由**：每個 caller 都要重複寫；下個 caller 又會踩同樣坑。

### Decision 2：歸一化邏輯支援三種 shape + fallback 空 array

**選擇**：

```ts
async listApplicationDeployments(appUuid: string): Promise<Deployment[]> {
  const raw = await this.request<unknown>(
    `/deployments/applications/${encodeURIComponent(appUuid)}`,
  );
  return normalizeDeploymentsResponse(raw);
}

function normalizeDeploymentsResponse(raw: unknown): Deployment[] {
  if (Array.isArray(raw)) return raw as Deployment[];
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as Deployment[];
    if (Array.isArray(obj.deployments)) return obj.deployments as Deployment[];
  }
  return [];
}
```

**理由**：

- `Array.isArray(raw)` 覆蓋 OpenAPI 宣稱的「正常」形狀。
- `obj.data` 覆蓋 Laravel 風 pagination wrapper（Coolify 後端是 Laravel，最可能形狀）。
- `obj.deployments` 覆蓋 named array wrapper。
- Fallback `[]` 覆蓋 `null` / `undefined` / 完全意外 shape — 符合 common rule「驗證優先」+「永不 silently swallow，但讓 caller 看到空集合而非 crash」。

**替代方案 A**：只支援 `Array.isArray` + 空 fallback。
**否決理由**：issue 已經說明回傳不是 array，幾乎可確定是某種 wrapper；只接受 array 等於沒修。

**替代方案 B**：失敗時 throw 自訂 error。
**否決理由**：`diagnoseApplication` 用 `Promise.allSettled` 設計就是要容錯；丟錯反而走 rejected 分支，diagnostic 的 deployments 變 null，issues 多一條雜訊但根本問題沒解。fallback 空 array 是更好的 graceful degradation。

### Decision 3：歸一化函式作為私有 helper 不 export

**選擇**：在 `client.ts` 內定義 `normalizeDeploymentsResponse` 為 module-private function（不加 `export`）。

**理由**：

- 不污染 public API surface。
- 本次只解一個 endpoint 的問題，沒有跨 module 重用需求（YAGNI）。
- 仍可被 `client.test.ts` 透過 native-fetch response fixture 間接測試。

**替代方案**：放到新的通用 utility module 或 export 出去。
**否決理由**：未來真有第二個 endpoint 出現同樣問題再抽出；目前抽出是 speculative generality。

### Decision 4：用 `unknown` + type guard 取代 type 斷言

**選擇**：`request<unknown>(...)` + 手寫 narrowing，而非 `request<Deployment[] | { data: Deployment[] } | { deployments: Deployment[] }>`。

**理由**：

- typescript/coding-style.md 明文：「Use unknown for external or untrusted input, then narrow it safely」。
- Union type 仍是斷言，runtime 不檢查；用 `unknown` 強制 narrowing。
- 程式碼更清楚表達「這是 untrusted external」。

## Risks / Trade-offs

- **風險**：fallback 空 array 會讓 caller 無法區分「真的沒有 deployments」和「Coolify 回傳了意外 shape」。  
  **緩解**：在 `normalizeDeploymentsResponse` 命中 fallback 時用 `console.warn` 記錄 raw shape 摘要（例如 `typeof raw`、top-level keys），方便日後 debug，但不丟錯。對純 MCP 用途的 stderr 寫入無副作用。

- **風險**：實際 Coolify 回傳的 wrapper key 不是 `data` 也不是 `deployments`，仍走 fallback。  
  **緩解**：先用 integration smoke test（`src/server.test.ts`）打真實 Coolify、`console.log` 一次 raw response shape 並寫入 verification log。若是其他 key，補一條 case，本 change 即可解決；若是更怪的形狀（如雙層 wrapper），再開 follow-up。

- **風險**：未來 Coolify 改 API、加新 wrapper，又靜默走 fallback。  
  **緩解**：上面 `console.warn` 提供早期信號；CHANGELOG 記下這條歸一化規則供下次 maintainer 找。

- **Trade-off**：unit test 只能覆蓋 mock 的三種已知 shape；對未知形狀沒有保證。這是「實際 API 形狀不穩」的本質限制，integration smoke test 是唯一真實驗證手段。

## Migration Plan

無 schema migration、無 breaking change：

1. 修 `listApplicationDeployments` + 加 helper。
2. 跑 `bun run build && bun run test && bun run check`。
3. 跑 integration smoke：`bun run test:integration`（需 `.env`）— 必須覆蓋 issue 列出的三種 query 形式（UUID / name / domain）並驗證 raw shape。
4. PR `develop → main`，Woodpecker tag release 自動 patch bump。
5. 合併後從 main `bun publish --access public`。

**Rollback**：revert PR，patch 版本即可（無資料變更、無外部介面破壞）。

## Open Questions

- Coolify 自架版（issue 提交環境）實際回傳的 deployments shape 是什麼？需要 integration smoke test 跑一次並把 raw shape 記到 verification log（`openspec/changes/.../verification-logs/`）才能確認 `data` 還是 `deployments` 哪一條 fallback 命中。本 change 的修法對這兩種都有 cover，但驗證仍是必要 evidence。
- 是否要把同樣的 normalization pattern 套到其他「list」endpoint？目前無證據觸發，本 change 不做，但開個 follow-up issue 追蹤更好。
