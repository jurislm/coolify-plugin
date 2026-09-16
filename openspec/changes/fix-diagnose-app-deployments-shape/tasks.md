> Current contract: use the generated `coolify_*` operations in `src/generated/operations.ts` and explicit wrappers registered with `registerTool` in `src/server.ts`; older action-oriented examples in this artifact are superseded. Executable checks live in Bun tests.

## 1. 確認真實 API 回傳形狀（先做，避免盲修）

- [x] 1.1 在 `.worktrees/develop` 確認當前位置：`git worktree list && pwd && git branch --show-current`
- [x] 1.2 檢查 `.env` 是否有目前支援的 `COOLIFY_URL` 與 `COOLIFY_TOKEN`；缺少時停止，不宣稱 live acceptance
- [x] 1.3 寫一支臨時 probe（`bun -e` inline）打 `GET /deployments/applications/{uuid}` 對 issue 列出的三個 app，印出 `typeof response`、`Array.isArray`、top-level keys
- [x] 1.4 把 raw shape 摘要寫入 `openspec/changes/fix-diagnose-app-deployments-shape/verification-logs/2026-05-05-deployments-shape-probe.md`（不存 raw response，只記 keys 與型別）
- [x] 1.5 探查完刪除臨時 probe script（用 inline `bun -e`，無實體檔案需刪）
- [x] 1.6 統一環境變數短名 `COOLIFY_URL` / `COOLIFY_TOKEN`：
  - `src/server.test.ts` and `src/stdio-protocol.test.ts` cover the current local test boundaries
  - `src/index.ts`、`README.md`、active plugin documentation 僅使用 canonical names
  - `COOLIFY_URL` 與 `COOLIFY_TOKEN` 是唯一支援的 runtime configuration

## 2. 實作 client 層 normalization

- [x] 2.1 在 `src/client.ts` 內新增 module-private `normalizeDeploymentsResponse(raw: unknown): Deployment[]` helper，依 design.md Decision 2 的順序：`Array.isArray` → `data` 鍵 → `deployments` 鍵 → fallback `[]`
- [x] 2.2 fallback 命中時 `console.warn` 印出 `typeof raw` + 若為 object 則印 `Object.keys(raw)`，不印 raw value（避免洩漏內容）
- [x] 2.3 修改 `listApplicationDeployments`：把 `request<Deployment[]>` 改為 `request<unknown>`，呼叫 `normalizeDeploymentsResponse` 後回傳，保持 `Promise<Deployment[]>` 簽章不變
- [x] 2.4 確認 `diagnoseApplication` 內 `deployments.slice(0, 5).filter(...)` 不需修改（因為 `deployments` 現在保證為 array 或 null — null 已被 line 1749 `if (deployments)` guard 處理）

## 3. Unit tests（required for codecov）

- [x] 3.1 在 `src/client.test.ts` 的 `listApplicationDeployments` describe 區塊新增 5 個 case：bare array / `data` wrapper / `{ count, deployments }` wrapper（實機 shape）/ unrecognized object / `null`
- [x] 3.2 新增 2 個 `diagnoseApplication` mock test：`{ count, deployments }` wrapper（實機）+ unrecognized shape；皆斷言 `errors` 不含 `slice`
- [x] 3.3 跑 `bun run test` 全綠（383 pass / 0 fail）

## 4. Local contract test

- [x] 4.1 在 `src/server.test.ts` 新增 mocked generated-operation regression test，避免 hardcoded live infrastructure
- [x] 4.2 跑 `bun test` 確認 local contract regression test 通過
- [x] 4.3 明確記錄 live credentials 缺席時不宣稱 external acceptance

## 5. 品質檢核（commit 前必須全綠）

- [x] 5.1 `bun run build` 全綠（修正 root cause：`bun install` 同步 lockfile + `tsconfig.json` exclude `__tests__`，避免 prepublishOnly 失敗阻擋 npm publish）
- [x] 5.2 `bun run test` 全綠（383 pass / 0 fail unit；10 pass / 0 fail integration — 修好 3 個既有 stale TEST_DATA 測試，改為 self-discovery）
- [x] 5.3 `bun run check` 0 errors / 0 warnings
- [x] 5.4 `bun run check` 全部通過

## 6. 文件更新

- [x] 6.1 Release metadata is maintained by the Woodpecker tag release workflow; no obsolete changelog automation is required
- [x] 6.2 `active plugin documentation` 的 Coolify API Gotchas 段加一條：「`/deployments/applications/{uuid}` 回傳 `{ count, deployments: [...] }` wrapper（非 array），client 已自動歸一化」
- [x] 6.3 `README.md` env vars 段已在 task 1.6 同步更新（短名 + deprecation note）

## 7. Commit & PR

- [x] 7.1 `git status` 確認所有改動位於 develop worktree 範圍
- [x] 7.2 拆兩個 commit：`fix:` (dae1439) + `chore:` (5437729)
- [x] 7.3 推 develop 分支
- [x] 7.4 PR #25 建立：https://github.com/jurislm/coolify-plugin/pull/25
- [x] 7.5 設 label `bug` + assignee `terry90918`（REST API）

## 8. Post-merge

- [ ] 8.1 等 Woodpecker tag release 開 release PR，merge 後從 main `bun publish --access public`
- [ ] 8.2 在 issue #24 留言確認 fix 已 release，附 npm 版本號
- [ ] 8.3 archive 此 change：`openspec archive fix-diagnose-app-deployments-shape` 並把 `verification-logs/` 一併保留
