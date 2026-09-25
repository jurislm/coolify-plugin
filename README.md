# @jurislm/coolify-plugin

Portable Coolify MCP plugin. It exposes focused `coolify_*` stdio tools generated from one pinned Coolify API contract.

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

`mcp.json` and `.mcp.json` use the same published-package `bunx` stdio registration as the Woodpecker CI plugin. `.mcp.json.example` contains placeholder environment values only. NPM package release is allowed. Remote MCP transport, OAuth, vault, hosting, and OpenAI Plugin Directory submission are out of scope.

For Codex repository marketplace installation, use the repository root and leave the sparse path empty. The supported marketplace manifest is `.agents/plugins/marketplace.json`; do not enter `plugins/codex`.
The Codex MCP registration forwards `COOLIFY_BASE_URL` and `COOLIFY_ACCESS_TOKEN` from the Codex session environment. A desktop session may not inherit values exported in a terminal; start a new task after configuring the app environment, then verify a read-only Coolify tool before making changes.

```sh
codex plugin marketplace add https://github.com/jurislm/coolify-plugin
codex plugin add coolify-plugin@coolify-marketplace
```

## Install in Cursor

In Cursor, open **Customize → Plugins → Add Marketplace → Import from GitHub**, enter `https://github.com/jurislm/coolify-plugin`, then install **Coolify Plugin**. Set `COOLIFY_BASE_URL` and `COOLIFY_ACCESS_TOKEN` in the plugin's **Configure** panel. Desktop-launched Cursor may not inherit values exported in a terminal; after saving, run a read-only Coolify tool to verify provider access.

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
