## Why

Issue [#24](https://github.com/jurislm/coolify-plugin/issues/24)：`diagnose_app` 工具對任何合法 query（UUID / name / domain）都固定噴錯 `Error: deployments.slice is not a function`，導致主要的診斷工具完全不可用。根因是 `listApplicationDeployments` 用 `Promise<Deployment[]>` 強制斷言型別，但實際 Coolify API 在某些版本回傳 pagination wrapper 物件（非 array），TypeScript 的型別斷言只是編譯期說明，runtime 沒有驗證 — 違反 common rule「validate at system boundaries」。OpenAPI 文件雖宣稱回傳 array，但 active plugin documentation 已明示 OpenAPI 不可靠，必須以實際 API 為準。

## What Changes

- 修改 `listApplicationDeployments`：在 client 層新增 runtime shape 歸一化邏輯，接受三種輸入並一律輸出 `Deployment[]`：
  - 直接是 array：原樣回傳
  - 物件含 `data: Deployment[]`（Laravel 風 pagination）：取 `.data`
  - 物件含 `deployments: Deployment[]`：取 `.deployments`
  - 其他（`null`、`undefined`、非預期形狀）：回傳空 array `[]`
- 用 `unknown` + type guard 取代直接的 `Deployment[]` 斷言（符合 typescript/coding-style.md 對 `unknown` 的要求）。
- 不修改 `diagnoseApplication` 內部邏輯（修在 client 層讓所有 caller 都受益，避免散落 patch）。
- 公開 API 簽章 `Promise<Deployment[]>` 不變 — 非 breaking change。
- 補 unit tests 覆蓋三種 shape + null/undefined 邊界。
- 補 integration smoke test 對真實 Coolify 驗證實際回傳形狀並記錄到 verification log。

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `smart-diagnostics`：`diagnose_app` 對 deployment shape 的容錯行為從「未定義」改為「明確接受 array / `data` wrapper / `deployments` wrapper / 空值」，並保證不會因 deployments shape 不符而整個診斷失敗。

## Impact

- **Affected code**：
  - `src/client.ts:1088-1090`（`listApplicationDeployments` 實作）
  - `src/client.ts:1748-1755`（`diagnoseApplication` 內 deployments 使用，邏輯不變但因上游修正而恢復可用）
  - `src/client.test.ts`（新增 shape 容錯測試）
  - `src/server.test.ts`（新增 smoke 驗證）
- **Affected tools**：`diagnose_app`（恢復可用）；任何呼叫 `listApplicationDeployments` 的內部 caller。
- **API contract**：對外 MCP tool schema 與 client method 簽章不變。
- **Dependencies**：無新增依賴。
- **Release**：`fix:` 等級 commit，patch bump（Woodpecker tag release 自動處理）。
