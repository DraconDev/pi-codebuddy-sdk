#!/usr/bin/env bash
# Smoke tests for pi-codebuddy-sdk provider.
# Requires: pi CLI, CodeBuddy (for Agent SDK subprocess).
# Requires: CODEBUDDY_SDK_TESTING_ALT_PROVIDER / CODEBUDDY_SDK_TESTING_ALT_MODEL

source "$(dirname "$0")/lib/bash-setup.sh"

echo "=== smoke-test.sh ==="

setup_test_env "smoke-test"

ALT_PROVIDER=$(require_env CODEBUDDY_SDK_TESTING_ALT_PROVIDER)
ALT_MODEL=$(require_env CODEBUDDY_SDK_TESTING_ALT_MODEL)

TIMEOUT=60
PASS=0
FAIL=0

TEST_CWD_PREFIX="$LOGDIR/smoke-cwd."
TEST_CWD=$(mktemp -d "$TEST_CWD_PREFIX"XXXXXX)
mkdir -p "$TEST_CWD/.pi"
printf '{"askCodebuddy":{"enabled":true}}\n' > "$TEST_CWD/.pi/codebuddy-sdk.json"
cd "$TEST_CWD"
cleanup() {
  if [[ "${TEST_CWD:-}" == "$TEST_CWD_PREFIX"* && ${#TEST_CWD} -gt ${#TEST_CWD_PREFIX} && -d "$TEST_CWD" ]]; then
    rm -rf -- "$TEST_CWD"
  fi
  kill_descendants
}
trap cleanup EXIT

run() {
  local name="$1"; shift
  local slug=$(echo "$name" | tr ' :,' '-' | tr -cd '[:alnum:]-')
  local logfile="$LOGDIR/$slug.log"
  printf "%-50s " "$name"
  if output=$(timeout "$TIMEOUT" "$@" < /dev/null 2>&1); then
    echo "$output" > "$logfile"
    if [ -n "$output" ]; then
      echo "PASS"
      ((++PASS))
    else
      echo "FAIL (empty output)"
      echo "  Log: $logfile"
      ((++FAIL))
    fi
  else
    local rc=$?
    echo "${output:-}" > "$logfile" 2>/dev/null || true
    echo "FAIL (exit $rc)"
    echo "  Log: $logfile"
    ((++FAIL))
  fi
  kill_descendants
}

# --- Tests ---

run "provider: print mode responds" \
  pi --no-session -ne -e "$DIR" \
  --model "codebuddy/claude-sonnet-4-6" \
  -p "Reply with just the word 'yes'"

run "provider: --provider flag works" \
  pi --no-session -ne -e "$DIR" \
  --provider codebuddy \
  -p "Reply with just the word 'yes'"

run "provider: model list includes provider" \
  bash -c "pi --no-session -ne -e '$DIR' --list-models 2>&1 | grep codebuddy"

# AskCodebuddy only registers when a non-codebuddy-sdk provider is active
run "tool: AskCodebuddy registered" \
  bash -c "pi --no-session -ne -e '$DIR' --mode json --provider '$ALT_PROVIDER' --model '$ALT_MODEL' -p 'list your tools' 2>&1 | grep -q AskCodebuddy && echo ok"

# AskCodebuddy e2e: force a non-Claude model to call the tool and check for a tool result
run "tool: AskCodebuddy responds" \
  bash -c "pi --no-session -ne -e '$DIR' --provider '$ALT_PROVIDER' --model '$ALT_MODEL' --mode json \
    -p 'Use the AskCodebuddy tool with prompt=\"What is 2+2? Reply with just the number.\" and then tell me the answer.' 2>&1 \
    | grep -q '\"toolName\":\"AskCodebuddy\"' && echo ok"

# --- Summary ---

echo ""
echo "Passed: $PASS  Failed: $FAIL"
[ "$FAIL" -eq 0 ] || exit 1
