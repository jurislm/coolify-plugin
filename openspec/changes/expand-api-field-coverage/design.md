## Context

coolify-plugin already covers All 192 Coolify API paths and 275 operations. The first alignment pass (align-coolify-api-fields) fixed env var fields, stop/delete params, and service request types. This second pass addresses the remaining field gaps: application has ~30 missing optional fields, server update has 6, databases lack `public_port_timeout`, backups miss retention limits, and deploy lacks PR/tag params.

## Goals / Non-Goals

**Goals:**

- Add all commonly-used optional fields to application, server, database, backup, storage, and deploy types
- Expose new fields through MCP tool schemas where they add value for AI assistants
- Maintain 100% test coverage and backward compatibility

**Non-Goals:**

- Adding fields to Application create types (they share the same `$allowedFields` as update in Coolify, but most fields only apply post-creation)
- Changing any existing field behavior or response types
- Restructuring MCP tool schemas

## Decisions

### D1: Add application fields to UpdateApplicationRequest only (not create types)

**Decision**: Add the ~25 new fields only to `UpdateApplicationRequest`. Leave individual `CreateApplication*Request` types unchanged.

**Rationale**: Coolify's API accepts all 84 fields on both create and update, but most configuration fields (domains, deployment commands, static flags) are only meaningful after the application exists. The create types already cover the essential fields needed for each creation method. Adding 25 fields to 6 different create interfaces would bloat the types with rarely-used create-time options.

### D2: Add all application fields to types but only expose high-impact ones in MCP schema

**Decision**: Add all ~25 fields to `UpdateApplicationRequest` TypeScript interface, but only add Tier 1 and selected Tier 2 fields to the `application` MCP tool's Zod schema.

**Rationale**: TypeScript types serve direct API callers who may need any field. MCP tool schemas should stay focused — adding 25 optional parameters makes the tool harder for AI assistants to use. Tier 3 fields (webhook secrets, nginx config) can be passed via the client directly.

### D3: Deploy parameters as query string params

**Decision**: Add `pull_request_id` and `docker_tag` as optional query parameters to `deployByTagOrUuid`, matching the existing `force` parameter pattern.

**Rationale**: The Coolify deploy endpoint accepts these as query params (`?pr=123&docker_tag=v1.0`). The existing method already handles `force` as a query param.

## Risks / Trade-offs

- **[MCP schema size]** → Adding too many optional params increases token usage. Mitigation: only expose high-impact fields in MCP tools; full field access available via client types.
- **[Field validation]** → Coolify API validates fields server-side; MCP adds Zod for basic type checking only. Mitigation: consistent with existing approach.
- **[Backward compatibility]** → All additions are optional fields. No risk to existing callers.
