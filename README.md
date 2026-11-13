# @jurislm/coolify-plugin

Portable Coolify MCP plugin. It exposes focused `coolify_*` tools generated from one pinned Coolify API contract, plus explicit composite tools for common workflows.

Official website: [JurisLM Coolify Plugin](https://jurislm.github.io/coolify-plugin/).

Follow the shared [JurisLM Plugin Architecture v1](https://github.com/jurislm/woodpecker-ci-plugin/blob/main/docs/plugin-architecture.md) for package, host configuration and acceptance boundaries.

## Scope

This repository provides a local Codex and Cursor plugin. It runs a stdio MCP server against a user-configured Coolify instance. OpenAI public Plugin Directory submission is outside this scope; public HTTPS, OAuth, and listing requirements are not acceptance criteria for this local plugin.

## 平台分發

| 介面 | 內容 | 官方依據 |
| --- | --- | --- |
| 共用 MCP stdio | `bun x @jurislm/coolify-plugin@latest` 行程 | [MCP transports（2025-11-25）](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)：stdout 只能輸出 MCP 訊息 |
| 可攜套件／npm | `plugin.json`、`mcp.json`、package `files` | Agent Plugins 可攜套件格式，發布到 npm |
| Codex | `.agents/plugins/marketplace.json`、`.codex-plugin/`、`.mcp.json` | 從 Git repo 根目錄以 Codex marketplace 安裝 |
| Cursor | `.cursor-plugin/marketplace.json` 指向 `plugins/cursor/` | [Cursor Plugins](https://cursor.com/docs/plugins.md)：`.cursor-plugin/plugin.json` 只要求 `name`，`version` 可省略 |
| Grok Bot | 本 repo 沒有 Grok Bot 專用的 Coolify manifest | [Grok Bot teams：Connector policy](https://docs.x.ai/grok-bot/teams-and-enterprises)：Grok Bot 沿用團隊在 Team Marketplace（Plugins & MCPs 頁）設定的 Cursor connector 政策，沒有另一份 Grok Bot connector 清單。[Grok Bot security](https://docs.x.ai/grok-bot/security)：Grok Bot 網路政策的「Apply to MCP servers」開關，和 Team Settings 裡管 Cursor 編輯器的 MCP Configuration 是分開的，改一個不會改另一個。目前找不到 Grok Bot 專用的外掛 schema，本 repo 不宣稱符合 |

驗收分成四層，彼此不能互相代替：

1. **安裝**：在宿主（Codex／Cursor）用 Git marketplace 或本機載入外掛。只跑離線 stdio 不能證明這一層。
2. **發布**：npm 套件內容，以及 Release Please 對 `package.json`、可攜 manifest、Codex manifest 的版本更新。
3. **載入**：宿主啟動 MCP 註冊（`bun x …@latest` 或選用的啟動器）。
4. **版本與行為**：`coolify_get_mcp_version` 和 `initialize.serverInfo` 回報實際解析到的套件版本；需要權杖的 Coolify 讀取是再下一步。

npm 套件會打包可攜與 Codex 檔案。`plugins/cursor/`、`.cursor-plugin/` 底下的 Cursor marketplace 檔案只放在 Git，若出現在 tarball，`package:check` 會直接失敗。Cursor 的 Configure 可以讓 `variables.required` 保持空陣列，這樣沒有權杖也能完成離線 initialize 和工具探索。

## Configure

The plugin reads the same global environment variables used by the Coolify setup:

```sh
export COOLIFY_BASE_URL=https://coolify.example
export COOLIFY_ACCESS_TOKEN=your-api-token
```

Build and run locally:

```sh
bun install --frozen-lockfile
bun run check
bun dist/index.js
```

`mcp.json`, `.mcp.json` and `plugins/cursor/mcp.json` launch the published package with `bun x` (not the separate `bunx` executable, which some package-manager shims break). When a connection variable is missing, empty, or an unsubstituted `${...}` placeholder, the server fills it from `~/.config/jurislm/plugin.env` (`KEY=value` or `export KEY=value` lines; override the path with `JURISLM_PLUGIN_ENV`); host values always take precedence and values are never logged. `.mcp.json.example` contains placeholder environment values only. NPM package release is allowed.

For Codex repository marketplace installation, use the repository root and leave the sparse path empty. The supported marketplace manifest is `.agents/plugins/marketplace.json`; do not enter `plugins/codex`.
The native Codex registration forwards `COOLIFY_CLOUD_BASE_URL`, `COOLIFY_CLOUD_ACCESS_TOKEN`, `CURSOR_COOLIFY_BASE_URL`, `CURSOR_COOLIFY_ACCESS_TOKEN`, `COOLIFY_BASE_URL` and `COOLIFY_ACCESS_TOKEN` from its owning environment. Portable `mcp.json` contains no host-specific fields or credential defaults.

```sh
codex plugin marketplace add https://github.com/jurislm/coolify-plugin
codex plugin add coolify-plugin@coolify-marketplace
```

### Codex desktop on macOS

A Codex process launched from the Dock or Finder does not read zsh startup files. If your connection settings are exported by `.zshenv`, install an exact released package into `~/.local/share/jurislm/mcp/coolify-plugin` using Bun 1.4.3 or newer. Keep its `package.json` and `bun.lock`; startup never installs or resolves packages. Then copy [`launchers/coolify-desktop.zsh`](launchers/coolify-desktop.zsh) to `~/.codex/bin/coolify-mcp.zsh` and [`launchers/validate-coolify-runtime.mjs`](launchers/validate-coolify-runtime.mjs) beside it, then add this opt-in override to `~/.codex/config.toml`:

```toml
[plugins."coolify-plugin@coolify-marketplace".mcp_servers.coolify]
enabled = false

[mcp_servers.coolify]
command = "/bin/zsh"
args = ["-f", "-c", 'source "$HOME/.codex/bin/coolify-mcp.zsh"']
startup_timeout_sec = 30
```

The launcher checks startup-file syntax before explicitly sourcing `${ZDOTDIR:-$HOME}/.zshenv`, suppresses stdout and preserves stderr. Source status 0 or 1 is accepted because a final optional guard can return 1; higher statuses stop startup. It retains only the six supported connection variables, `HOME`, `PATH`, `TMPDIR` and `LANG`, fixes PATH to `$HOME/.bun/bin:/usr/bin:/bin` and executes the installed `dist/index.js` using the absolute `$HOME/.bun/bin/bun` with `--no-env-file --no-install`. It validates the runtime manifest against the lock, installed identity and binary path first. Mutable versions, missing files and version drift fail without protocol output. `bun x` is deliberately avoided because its executable subprocess can reload `.env` despite the parent flag. The `--require-config` option reuses `loadConfig` to require the selected complete URL/token pair before starting stdio; trim, placeholder handling and pair precedence remain the same. Ordinary portable initialization and tool discovery can still start without credentials.

Prepare each install or update in a separate staging directory. For example, from that directory run `bun add --exact @jurislm/coolify-plugin@<approved-version>`, then `bun install --frozen-lockfile`. An offline recovery may use a verified release tarball stored inside that directory, such as `artifacts/coolify-plugin-<version>.tgz`, with dependency `file:artifacts/coolify-plugin-<version>.tgz`. Offline installation requires a complete Bun cache for the same platform, including every transitive dependency, or a verified recovery artifact containing the complete installed dependency tree; the release tarball alone is insufficient. On the first install run `bun install --offline` to create `bun.lock`, then verify a clean rebuild with `bun install --offline --frozen-lockfile`; an existing locked installation uses the frozen command directly. Absolute paths and tarballs outside the runtime are rejected. Do not copy credentials into the runtime.

Before selecting the installation, run the shipped validator against the staging directory, verify published package contents and the resolved version, and perform a no-network stdio initialize test using dummy credentials. Keep the prior runtime until the replacement passes. Move the verified complete directory to `~/.local/share/jurislm/mcp/coolify-plugin` while this MCP is stopped; retain the prior directory for rollback. Update the launcher and validator together from the same reviewed release. Do not change `required`, tool approvals or network settings to mask startup failures.

Check `codex mcp get coolify`, restart Codex and open a fresh chat. Read `coolify_get_mcp_version` before connection checks and authenticated reads. Record the resolved package version, actual registration source, HTTP status and returned counts. Standalone stdio checks establish process behavior; fresh chat registration and provider reads require their own evidence.

To check a connection, call `coolify_get_mcp_version`, then `coolify_check_connection`. The second tool reports the selected variable pair, whether a URL and credential are present, and the HTTP status of `/health` and `/version`. It never returns credential values. With a URL but no credential, it still checks public `/health` and leaves `/version` unattempted. A healthy `/health` with a 401 from `/version` means the instance is reachable but rejected the authenticated request; the response alone does not establish whether the credential expired, was revoked, or came from the wrong launcher.

Check the active MCP registration separately. A standalone server named `coolify` can run the same package while the marketplace plugin's MCP is disabled. `coolify_get_mcp_version` identifies the package version, not which registration launched it. `coolify_get_infrastructure_overview` reports authentication failures and all-list failures as tool errors. When only some lists fail for other reasons, their counts are `null` and `complete` is `false`.

## Install in Cursor

In Cursor, open **Customize → Plugins → Add Marketplace → Import from Repo**, enter `https://github.com/jurislm/coolify-plugin`, then install **Coolify Plugin**. The marketplace selects `plugins/cursor`, keeping the Codex-only root `.mcp.json` out of Cursor's plugin root. For Cloud Agents, set both `COOLIFY_BASE_URL` and `COOLIFY_ACCESS_TOKEN` in the Cloud environment's secrets and start a new agent from that environment. Local agents can use the plugin's **Configure** panel. After updating from v4.0.16 or earlier, re-enter both Local Configure fields because their variable names changed. If either Cloud environment variable is set, the plugin uses only the Cloud pair and does not mix it with Configure values. Run a read-only Coolify tool to verify provider access.

If Cursor Cloud passes literal `${COOLIFY_BASE_URL}` and `${COOLIFY_ACCESS_TOKEN}` to a stdio server, also set `COOLIFY_CLOUD_BASE_URL` and `COOLIFY_CLOUD_ACCESS_TOKEN` in the same Cloud environment. The plugin uses this pair first and never mixes it with the canonical or Configure pair.

For local agents, a complete saved Configure URL/token pair takes precedence over inherited `COOLIFY_BASE_URL` and `COOLIFY_ACCESS_TOKEN` values. It does not combine values from different sources.

## OpenAPI contract

`openapi/coolify-openapi.json` is built from the official Coolify v4.3.23 release. `api/manifest.json` records the upstream SHA-256, the current API contract corrections, and the persisted SHA-256. `bun run api:check` verifies the contract offline before checking generated parity. The server registers every generated operation with its generated schema and adds explicit composite capabilities for connection checks, inventory, diagnostics, and batch operations.

```sh
bun run api:fetch
bun run api:generate
bun run api:check
```

## Checks

```sh
bun run check
bun run api:check
bun run lint
bun run typecheck
bun test
bun run build
bun run package:check
```

## License

MIT
