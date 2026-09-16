> Current contract: use the generated `coolify_*` operations in `src/generated/operations.ts` and explicit wrappers registered with `registerTool` in `src/server.ts`; older action-oriented examples in this artifact are superseded. Executable checks live in Bun tests.

## ADDED Requirements

### Requirement: CreateStorageRequest supports fs_path

The `CreateStorageRequest` type SHALL include optional field `fs_path` (string) for directory-based file storage mounts.

#### Scenario: Create directory storage with fs_path

- **WHEN** a caller creates a storage with `fs_path: "/data/uploads"` and `is_directory: true`
- **THEN** the client includes `fs_path` in the POST request body
