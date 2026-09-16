> Status: superseded source-history record; the requirements and scenarios below are non-normative. The current contract is generated `coolify_*` operations in `src/generated/operations.ts` plus explicit wrappers registered with `registerTool` in `src/server.ts`. Executable checks live in Bun tests.

# connect-method-coverage Specification

## Purpose

TBD - created by archiving change improve-test-coverage-100. Update Purpose after archive.

## Requirements

### Requirement: connect() method is covered by Bun test

`createServer.connect()` SHALL be exercised in the test suite so that lines 173-176 are covered.

#### Scenario: connect() delegates to super.connect with mock transport

- **WHEN** a `createServer` is constructed and `connect()` is called with a minimal test transport whose `start` resolves undefined
- **THEN** the call resolves without error and the mock transport's `start` has been invoked
