# Contributing

Guide for maintainers. End users only need [README.md](README.md).

## Prerequisites

- **Node.js** ≥ 20
- **`pi`** CLI on `PATH` (global install, not `node_modules/.bin/pi`)
- **`codebuddy`** CLI on `PATH` (Agent SDK spawns it as a subprocess)
- **CodeBuddy auth** — same three options as README: `codebuddy login`, `CODEBUDDY_API_KEY`, or iOA (`CODEBUDDY_INTERNET_ENVIRONMENT=ioa`)

```bash
git clone <repo>
cd pi-codebuddy-sdk
npm install
npm run typecheck
```

## Architecture (short)

| Piece | Role |
|-------|------|
| `src/index.ts` | Pi extension entry: provider, AskCodebuddy, compact hooks |
| MCP bridge | Pi tools → `createSdkMcpServer` → CodeBuddy SDK; Pi executes tools |
| `src/cb-session-io.ts` | Read/write CodeBuddy session JSONL for resume/rebuild |
| `src/skills.ts` | Forward Pi system prompt + rewrite skill `read` tool for MCP |
| `src/sdk-gate.ts` | Serialize SDK subprocesses (model discovery) |

CodeBuddy built-in tools are disabled (`tools: []`). Only Pi-bridged MCP tools are visible when `strictMcpConfig` is on (default).

## npm scripts

| Script | What it does | Auth needed |
|--------|----------------|-------------|
| `npm run typecheck` | `tsc --noEmit` | No |
| `npm run test:unit` | Offline unit tests in `tests/unit-*.mjs` | No |
| `npm test` | Unit + bash smoke/multi-turn/cache + `tests/int-*.mjs` | Yes (CodeBuddy); optional `.env.test` for alt-provider tests |

### Quick checks

```bash
npm run typecheck
npm run test:unit
node --import tsx --test tests/int-session-new.mjs   # single integration smoke
```

### Full suite

```bash
npm test
```

Runs outside a sandbox if possible — tests use local `~/.pi`, `~/.codebuddy`, and your CodeBuddy login.

## Maintainer environment variables

Users do **not** need these. They exist for debugging, test isolation, or CodeBuddy ecosystem compatibility.

### Debug (optional)

| Variable | Set by | Purpose |
|----------|--------|---------|
| `CODEBUDDY_SDK_DEBUG=1` | You | Enable extension debug logging |
| `CODEBUDDY_SDK_DEBUG_PATH` | Tests / you | Log file path (default: `~/.pi/agent/codebuddy-sdk.log`) |

```bash
export CODEBUDDY_SDK_DEBUG=1
pi   # reproduce issue, then inspect log
```

**Privacy:** Debug logs record metadata only (lengths, IDs, redacted paths). Prompts, tool bodies, and CLI stderr are **not** copied into extension logs. CLI subprocess may still write its own files under `~/.pi/agent/cb-cli-logs/` when debug is on — treat as local-only and delete after use.

### Injected by the extension (do not set manually)

| Variable | Where | Why |
|----------|-------|-----|
| `DISABLE_AUTO_COMPACT=1` | CodeBuddy child `env` | Pi owns compaction; prevents double-compact |

### Passthrough (only if your CodeBuddy CLI uses them)

| Variable | Purpose |
|----------|---------|
| `CODEBUDDY_API_KEY` | API key auth (README) |
| `CODEBUDDY_INTERNET_ENVIRONMENT=ioa` | iOA network (README) |
| `CODEBUDDY_CONFIG_DIR` | Non-default CodeBuddy config dir; session I/O must match CLI — extension reads this automatically |

The extension passes through `process.env` to the CodeBuddy subprocess so login and keys work without extra wiring.

### Integration tests only

Copy `.env.test.example` → `.env.test` (gitignored):

```bash
cp .env.test.example .env.test
```

| Variable | Used by |
|----------|---------|
| `CODEBUDDY_SDK_TESTING_ALT_PROVIDER` | `int-smoke.sh`, `int-session-resume.mjs` |
| `CODEBUDDY_SDK_TESTING_ALT_MODEL` | Same — a non-CodeBuddy Pi provider for cross-provider tests |

Optional:

| Variable | Used by |
|----------|---------|
| `FUZZ=1` | `tests/unit-queue.mjs` fuzz suite |

## Test layout

```
tests/
  unit-*.mjs          # Offline; no pi subprocess
  int-*.mjs           # RPC harness against real `pi` + CodeBuddy
  int-*.sh            # Bash multi-turn / cache / smoke
  lib/
    rpc-harness.mjs   # Spawns `pi --mode rpc`, loads `.env.test` if present
    bash-setup.sh     # Sets DEBUG paths under .test-output/
  fixtures/           # Minimal extensions and files for integration tests
```

Artifacts go to **`.test-output/`** (gitignored). Never commit that directory.

### Per-test notes

- **`int-session-new.mjs`** — Fastest end-to-end smoke after auth works.
- **`int-tool-message.mjs`** — Tool bridge + steer; slow (~35–40s per steer case).
- **`int-session-resume.mjs`** — Needs `.env.test` alt provider.
- **`int-smoke.sh`** — AskCodebuddy + provider; needs `.env.test`.
- Bash scripts use `< /dev/null` where stdin is not a TTY.

## Local development with Pi

```bash
pi install /absolute/path/to/pi-codebuddy-sdk
# or after publish: pi install npm:pi-codebuddy-sdk
```

Then in Pi: `/model` → pick `codebuddy/...`.

Optional config: `~/.pi/agent/codebuddy-sdk.json` — see README.

## Security and secrets

**Never commit:**

- `.env`, `.env.test`, API keys, tokens, or debug logs
- `.test-output/`, `*.log`, `~/.pi/agent/codebuddy-sdk*.log`, `~/.pi/agent/cb-cli-logs/`

**Runtime behavior:**

- Extension logs (when `CODEBUDDY_SDK_DEBUG=1`): metadata only; home directory paths redacted to `~`; no prompt/tool body text; CLI stderr not forwarded
- Pi UI notifications: shortened messages; paths redacted
- `diagDump` and file logging are disabled unless debug is on

**In code and fixtures:**

- Use generic paths (`/tmp/...`), not real home directories or usernames
- Do not add scripts that read OS keychains or print bearer tokens
- Do not log prompt text, tool results, or raw CLI stderr in extension code

**Before opening a PR:** `git status` should not show `.test-output/`, `.env.test`, or log files.

## Commits

Do not auto-commit from agents. Use conventional, accurate messages when committing manually.

## Questions

Open an issue or check debug logs with `CODEBUDDY_SDK_DEBUG=1` before filing bugs — attach **redacted** excerpts only (no API keys, no full prompts).
