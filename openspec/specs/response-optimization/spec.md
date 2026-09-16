---
title: Response Optimization Specification
version: 1.0.0
date: 2026-04-07
---

> Current contract: use the generated `coolify_*` operations in `src/generated/operations.ts` and explicit wrappers registered with `registerTool` in `src/server.ts`; older action-oriented examples in this artifact are superseded. Executable checks live in Bun tests.


## Purpose

Define token-efficient response behavior and payload safety constraints for MCP responses.

## Requirements

### Requirement: List-style responses must prioritize token-efficient summaries

List-oriented operations MUST default to summary representations with essential identity and status fields instead of full nested resource payloads.

#### Scenario: Retrieve application list

- **WHEN** a client requests a list endpoint
- **THEN** the response returns compact summary objects suitable for discovery and navigation

#### Scenario: Retrieve single resource details

- **WHEN** a client requests a get endpoint for a specific resource
- **THEN** the response can include fuller details for troubleshooting and inspection

### Requirement: Responses may include actionable next-step hints

The server MUST attach action metadata that helps clients choose valid follow-up operations for the returned resource state.

#### Scenario: Running application response

- **WHEN** a response describes an application in a running state
- **THEN** action hints include operational follow-ups such as restart or stop and log inspection

#### Scenario: Non-running application response

- **WHEN** a response describes an application in a non-running state
- **THEN** action hints include an operation to start the application

### Requirement: Large log payloads must be truncated safely

Application log handling MUST enforce size limits to avoid unbounded payload growth while preserving useful recent output.

#### Scenario: Log content exceeds limits

- **WHEN** logs exceed configured line or character boundaries (default: 200 lines, 50,000 characters)
- **THEN** output is truncated to the most recent content and clearly indicates truncation with the prefix `"...[truncated]...\n"` prepended to the retained tail

#### Scenario: Log content within limits

- **WHEN** logs are below both the line limit (200) and character limit (50,000)
- **THEN** logs are returned without truncation artifacts

#### Scenario: Truncation precedence

- **WHEN** log content exceeds the line limit but not the character limit
- **THEN** only the line-based truncation applies (keep last N lines)
- **WHEN** the line-truncated result still exceeds the character limit
- **THEN** character-based truncation is applied as a safety net on top of the already line-truncated content
