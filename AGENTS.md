# Agent Guidelines

For humans: see [CONTRIBUTING.md](CONTRIBUTING.md).

## Commit

Do **not** auto-commit.

## Secrets

Never commit `.env`, `.env.test`, `.test-output/`, logs, API keys, or real home paths in fixtures. See CONTRIBUTING.md security section.

## Tests

- `npm run test:unit` — offline
- `npm test` — full suite; needs CodeBuddy auth; see CONTRIBUTING.md
