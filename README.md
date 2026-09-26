# @jurislm/coolify-plugin

Portable Coolify MCP plugin. It exposes focused `coolify_*` stdio tools generated from one pinned Coolify API contract.

## Scope

This repository provides a local Codex and Cursor plugin. It runs a stdio MCP server against a user-configured Coolify instance. OpenAI public Plugin Directory submission is outside this scope; public HTTPS, OAuth, and listing requirements are not acceptance criteria for this local plugin.

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

`mcp.json` and `.mcp.json` use the same published-package `bunx` stdio registration as the Woodpecker CI plugin. `.mcp.json.example` contains placeholder environment values only. NPM package release is allowed.

For Codex repository marketplace installation, use the repository root and leave the sparse path empty. The supported marketplace manifest is `.agents/plugins/marketplace.json`; do not enter `plugins/codex`.
The Codex MCP registration forwards `COOLIFY_BASE_URL` and `COOLIFY_ACCESS_TOKEN` from the Codex session environment. A desktop session may not inherit values exported in a terminal; start a new task after configuring the app environment, then verify a read-only Coolify tool before making changes.

```sh
codex plugin marketplace add https://github.com/jurislm/coolify-plugin
codex plugin add coolify-plugin@coolify-marketplace
```

## Install in Cursor

In Cursor, open **Customize → Plugins → Add Marketplace → Import from GitHub**, enter `https://github.com/jurislm/coolify-plugin`, then install **Coolify Plugin**. The marketplace selects `plugins/cursor`, keeping the Codex-only root `.mcp.json` out of Cursor's plugin root. For Cloud Agents, set both `COOLIFY_BASE_URL` and `COOLIFY_ACCESS_TOKEN` in the Cloud environment's secrets and start a new agent from that environment. Local agents can use the plugin's **Configure** panel. After updating from v4.0.16 or earlier, re-enter both Local Configure fields because their variable names changed. If either Cloud environment variable is set, the plugin uses only the Cloud pair and does not mix it with Configure values. Run a read-only Coolify tool to verify provider access.

If Cursor Cloud passes literal `${COOLIFY_BASE_URL}` and `${COOLIFY_ACCESS_TOKEN}` to a stdio server, also set `COOLIFY_CLOUD_BASE_URL` and `COOLIFY_CLOUD_ACCESS_TOKEN` in the same Cloud environment. The plugin uses this pair first and never mixes it with the canonical or Configure pair.

## OpenAPI contract

`openapi/coolify-openapi.json` is built from the official Coolify v4.3.23 release. `api/manifest.json` records the upstream SHA-256, the current API contract corrections, and the persisted SHA-256. `bun run api:check` verifies the contract offline before checking generated parity. The runtime uses the generated schemas directly.

```sh
bun run api:fetch
bun run api:generate
bun run api:check
```

## Checks

```sh
bun run api:check
bun run typecheck
bun test
bun run build
bun run package:check
```

## License

MIT
