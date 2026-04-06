# TerraMatch v3 CLI

## `tm-v3-cli is not a shell command`

There is no global `tm-v3-cli` on your `PATH` unless you install it yourself. From the repo root:

- **After build:** `npm run tm-v3-cli -- migrations up` (or `status`). Build first: `npx nx run tm-v3-cli:build`.
- **Dev (TypeScript directly):** `npm run tm-v3-cli:dev -- migrations up`

The CLI loads the repo-root `.env` file when present (same `DB_*` vars as Nest services). You can export them in the shell instead if you prefer.

## Building

Run `npx nx run tm-v3-cli:build` to compile the CLI to `dist/tm-v3-cli/`.
