# Project Rules

## Required workflow

- After every code or configuration change, run the relevant focused tests and checks.
- Before considering any task complete, run the full verification suite: `node --test tests/*.test.mjs`, `npm run lint`, and `npm run build` using Node.js 22 or the project Docker build.
- Only when every required check passes, review the diff for secrets and unintended changes, then commit and push the current branch.
- Never push changes when any required check fails. Fix the failure and rerun the complete verification suite first.
- Do not commit secrets, `.env` files, credentials, API keys, or production data.

## Windows verification with Linux dependencies

- If `node_modules` contains Linux binaries and Windows cannot resolve `oxlint` or `next`, run tests and lint in Docker rather than changing dependencies: `docker run --rm --mount "type=bind,source=E:\Git\careboard,target=/app,readonly" -w /app node:22-bookworm-slim sh -c "node --test tests/*.test.mjs && npm run lint"`.
- Use `docker build -t careboard-ui-verify .` for the production build; the project Dockerfile runs `npm run build` with Node.js 22.
