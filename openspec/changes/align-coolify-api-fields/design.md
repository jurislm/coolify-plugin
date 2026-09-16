> Current contract: use the generated `coolify_*` operations in `src/generated/operations.ts` and explicit wrappers registered with `registerTool` in `src/server.ts`; older action-oriented examples in this artifact are superseded. Executable checks live in Bun tests.

## Context

coolify-plugin wraps the official generated Coolify REST contract into focused `coolify_*` MCP tools. The codebase follows the current layering: persisted API snapshot/manifest → generated types and operations → client → explicit capabilities → `registerTool` → Bun tests. The generated contract currently contains 192 paths and 275 operations; wrapper behavior is kept separately for v3.6 composite workflows.

## Goals / Non-Goals

**Goals:**

- Align all request types with Coolify v4.0.0-beta.471 API accepted fields
- Add missing optional parameters to stop and delete operations
- Maintain backward compatibility (all additions are optional fields)
- Pass codecov coverage requirements for all changed/added code

**Non-Goals:**

- Adding new API endpoints or MCP tools
- Changing response types or summary optimization logic
- Updating OpenAPI spec chunks in `docs/openapi-chunks/`
- Changing the `is_build_time` field name (keep for backward compat, add `is_runtime`/`is_buildtime` alongside)

## Decisions

### D1: Keep `is_build_time` alongside `is_runtime`/`is_buildtime`

**Decision**: Add `is_runtime` and `is_buildtime` as new optional fields to env var request types. Keep `is_build_time` for backward compatibility.

**Rationale**: Existing callers may use `is_build_time`. The Coolify API accepts `is_runtime` and `is_buildtime` (no underscore in "buildtime"). Adding both ensures the client works with the real API while not breaking existing integrations.

**Alternative considered**: Rename `is_build_time` → `is_buildtime`. Rejected because it's a breaking change with no benefit — both can coexist.

### D2: Add `docker_cleanup` as an optional parameter to stop methods

**Decision**: Change stop method signatures from `stopX(uuid: string)` to `stopX(uuid: string, options?: StopOptions)` where `StopOptions = { dockerCleanup?: boolean }`.

**Rationale**: Follows the existing pattern used by `deleteApplication(uuid, options?: DeleteOptions)`. Query string parameter matches Coolify API's `?docker_cleanup=true/false`.

**Alternative considered**: Add as a second boolean parameter. Rejected because options object is more extensible and consistent with existing patterns.

### D3: Add `force` to server delete via existing `DeleteOptions` pattern

**Decision**: Add `force?: boolean` to the `deleteServer` method as a query parameter, not by extending `DeleteOptions` (which is app/db/service specific with `deleteConfigurations`, `deleteVolumes`, etc.).

**Rationale**: Server force-delete is semantically different from app delete options. A simple `deleteServer(uuid: string, options?: { force?: boolean })` is clearest.

### D4: Expand `UpdateServiceRequest` in-place

**Decision**: Add `urls`, `force_domain_override`, `is_container_label_escape_enabled`, and `connect_to_docker_network` to the existing `UpdateServiceRequest` interface. Remove the `@deprecated fqdn` field.

**Rationale**: The Coolify API now accepts these fields on PATCH `/services/{uuid}`. The `fqdn?: never` was a documentation-only guard that's no longer needed since the `urls` field is the proper replacement.

## Risks / Trade-offs

- **[Field name mismatch]** → Coolify uses `is_buildtime` (no underscore) while MCP has `is_build_time` (with underscore). Mitigation: support both, document the canonical Coolify names.
- **[Service update complexity]** → The `urls` field on services has a complex structure (`Array<{name: string, url: string}>`). Mitigation: type it properly, add JSDoc examples.
- **[Backward compatibility]** → All changes are additive (optional fields). Risk is minimal. No migration needed.
