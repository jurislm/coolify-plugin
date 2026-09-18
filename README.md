# @jurislm/coolify-plugin

Portable Coolify MCP plugin. It exposes focused `coolify_*` stdio tools generated from the committed official Coolify OpenAPI snapshot.

## Configure

Only these environment variables are accepted:

```sh
export COOLIFY_URL=https://coolify.example
export COOLIFY_TOKEN=your-api-token
```

Build and run locally:

```sh
bun install --frozen-lockfile
bun run check
bun dist/index.js
```

`mcp.json` and `.mcp.json` use the same published-package `bunx` stdio registration as the Woodpecker CI plugin. `.mcp.json.example` contains placeholder environment values only. NPM package release is allowed. Remote MCP transport, OAuth, vault, hosting, and OpenAI Plugin Directory submission are out of scope.

For Codex repository marketplace installation, use the repository root and leave the sparse path empty. The supported marketplace manifest is `.agents/plugins/marketplace.json`; do not enter `plugins/codex`.

## OpenAPI contract

`openapi/coolify-openapi.json` is fetched from the official Coolify repository. `api/manifest.json` records its source, fetch time, persisted-snapshot SHA-256, document/info versions, path count, and operation count. `bun run api:check` verifies the snapshot offline before checking generated parity.

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
