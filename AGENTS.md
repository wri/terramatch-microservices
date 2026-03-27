# AGENTS.md – AI Coding Instructions for this NestJS + TypeScript repo

## Controller Guidelines (strictly enforced)

- All controllers MUST follow REST principles only. Never use RPC-style method names (no `getUserById`, `createOrder`, etc.).
- Method names must be standard HTTP verbs + resource: `findAll`, `findOne`, `create`, `update`, `remove`, etc.
- Every controller method MUST include these decorators in this order:
  - `@ApiOperation({ summary: "..." })`
  - `@ApiOkResponse({ type: ... })` or appropriate `@ApiResponse`
  - `@ApiBadRequestResponse({ description: "..." })`, `@ApiUnauthorizedResponse`, etc. for exceptions
- Every controller method MUST call `this.policyService.checkPermission(...)` (or equivalent) with the appropriate permission before any business logic.
- Every response MUST use the local `buildJsonApi(...)` helper (import from `@/common/helpers/json-api.helper` or wherever it lives). Never return raw objects or DTOs directly.

## General Rules

- Always respect existing folder structure (controllers in `src/modules/*/controllers/`, etc.).
- Use NestJS best practices for guards, interceptors, and pipes.
- Never invent new patterns – follow the established ones in the codebase.
