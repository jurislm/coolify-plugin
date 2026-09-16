# @jurislm/coolify-plugin

Private, local-only Coolify MCP plugin. It exposes 275 focused `coolify_*` stdio tools generated from the committed official Coolify OpenAPI snapshot.

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

`mcp.json` is a portable stdio registration; `.mcp.json.example` is the absolute-path example. No HTTP MCP endpoint, OAuth flow, registry publishing, or compatibility credential aliases are included.

## OpenAPI contract

`openapi/coolify-openapi.json` is fetched from the official Coolify repository. `openapi/manifest.json` records its source, fetch time, SHA-256, path count, and operation count.

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
