# Deployments endpoint shape probe — 2026-05-05

## Goal

確認 issue #24 中 Coolify `GET /api/v1/deployments/applications/{uuid}` 實際回傳 shape，作為 `listApplicationDeployments` 歸一化邏輯的 evidence。

## Method

用 `bun -e` 直接 fetch endpoint，**不印 raw response**，只記錄：HTTP status / typeof body / Array.isArray / top-level keys。

連線資訊：這是歷史 probe；當時使用的 credential configuration 已不再是目前支援的介面。現行 runtime 僅接受 `COOLIFY_URL` / `COOLIFY_TOKEN`，本 log 不構成目前 live acceptance。

對 issue 列出的三個 query 跑：

| Query                      | Type |
| -------------------------- | ---- |
| `lawyer-prod-app`          | name |
| `r7din51thj8p0u67ghy6gqxc` | UUID |
| `rqtyuu0b70sk079m4cg48uky` | UUID |

## Findings

| Query                      | HTTP | typeof | isArray | Top-level keys             |
| -------------------------- | ---- | ------ | ------- | -------------------------- |
| `lawyer-prod-app`          | 404  | object | false   | `["message"]`              |
| `r7din51thj8p0u67ghy6gqxc` | 200  | object | false   | `["count", "deployments"]` |
| `rqtyuu0b70sk079m4cg48uky` | 200  | object | false   | `["count", "deployments"]` |

## Conclusions

1. **實際 wrapper 形狀**：`{ count: number, deployments: Deployment[] }`。  
   命中 design.md Decision 2 的第三條 fallback path：`Array.isArray(obj.deployments) ? obj.deployments : ...`。  
   → 不需修改 design；實作繼續。

2. **`data` wrapper 沒命中**：design 預備的 Laravel-style `{ data: [...] }` fallback 在這個 self-hosted Coolify 版本下未觸發，但仍保留作 future-proof（避免下次 Coolify upgrade 換 wrapper 又踩坑）。

3. **Endpoint 只接受 UUID**：`lawyer-prod-app`（name）回 404 + `{ message }`。issue 提到 name 也失敗，是因為 `diagnoseApplication` 先 `the wrapper list-applications lookup()` 解成 UUID 才打 deployments，所以最終崩在 `slice` 同一處。client 層 normalize 後三種 query 都能完成診斷。

4. **404 回傳的 `{ message }` 不是 deployments shape**：但 normalization 不會被觸發 — `request<T>()` 對 4xx/5xx 已經 throw（`client.ts` 既有錯誤處理），會走 `Promise.allSettled` 的 rejected 分支由 `extract()` 收進 `errors` 陣列。實際 200 回傳才會進入 normalize。

## Coolify version note

實機回傳格式 `{ count, deployments }`，OpenAPI（`openapi/coolify-openapi.json:4203`）宣稱 `type: array` — 兩者不一致，再次驗證 active plugin documentation「The Coolify OpenAPI docs are unreliable」的提醒。

## Probe script

未保留實體檔案。命令以 inline `bun -e` 執行，`.env` 已寫入但 gitignored、mode 600。

## Implementation evidence (post-fix)

### Unit tests (2026-05-05)

```
$ bun run test
383 pass / 0 fail / 803 expect() calls
```

新增 7 個 case：

- `listApplicationDeployments` shape normalization × 5（bare array / `data` wrapper / `{ count, deployments }` wrapper / unrecognized object / `null`）
- `diagnoseApplication` × 2（wrapper shape + unrecognized shape；皆驗證 `errors` 不含 `slice`）

### Integration smoke (2026-05-05)

```
$ bun test --timeout 60000 ./src/server.test.ts
4 pass / 3 fail / 21 expect() calls
```

通過：

- `does not crash on real Coolify deployments wrapper shape (issue #24)` ✓ — self-discover 真實 app UUID，呼叫 `diagnoseApplication`，命中真實 `{ count, deployments }` shape，`recent_deployments` 為 array、`errors` 不含 `slice`/`not a function`

失敗（不在本 change 範圍）：

- `should return diagnostic data for a healthy application` — TEST_DATA.APP_UUID_HEALTHY 是他人 infrastructure UUID，在當前 Coolify 不存在
- `should detect issues in an unhealthy application` — 同上
- `should return diagnostic data for a server` — TEST_DATA.SERVER_UUID 同樣 stale

→ 這 3 個既有失敗已在後續 commit `f97fa4c` 修正：改為 self-discovery 模式（從 `listApplications` / `listServers` 動態取真實 UUID），不再依賴 hardcoded 環境特定值。

## Status

本 verification 已完整支撐 PR #25 的設計與實作。後續 PR review feedback（round 1 / round 2）的修正紀錄見對應 commit log，不在此 log 範圍內。
