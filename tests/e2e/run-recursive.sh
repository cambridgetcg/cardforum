#!/usr/bin/env bash
set -euo pipefail

#
# Recursive Playwright Test Runner
#
# Runs tests in a loop: test → analyze failures → report → prompt retry.
# Captures traces, screenshots, and failure summaries for each iteration.
#
# Usage:
#   ./tests/e2e/run-recursive.sh                    # Run all e2e tests
#   ./tests/e2e/run-recursive.sh smoke              # Run only smoke tests
#   ./tests/e2e/run-recursive.sh browse --debug     # Debug mode (headed + traces)
#   ./tests/e2e/run-recursive.sh --max-iterations 5 # Limit retry loops
#
# Environment:
#   E2E_MAX_ITERATIONS  — max retry loops (default: 10)
#   E2E_AUTO_RETRY      — auto-retry without prompt (default: false)
#   E2E_DEBUG           — force debug config (default: false)
#

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
RESULTS_DIR="$PROJECT_ROOT/test-results"
REPORT_DIR="$PROJECT_ROOT/playwright-report"

# Parse args
SPEC_FILTER=""
MAX_ITERATIONS="${E2E_MAX_ITERATIONS:-10}"
AUTO_RETRY="${E2E_AUTO_RETRY:-false}"
USE_DEBUG="${E2E_DEBUG:-false}"
CONFIG="$PROJECT_ROOT/playwright.config.ts"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --max-iterations)
      MAX_ITERATIONS="$2"; shift 2 ;;
    --debug)
      USE_DEBUG="true"; shift ;;
    --auto-retry)
      AUTO_RETRY="true"; shift ;;
    *)
      SPEC_FILTER="$1"; shift ;;
  esac
done

if [[ "$USE_DEBUG" == "true" ]]; then
  CONFIG="$PROJECT_ROOT/tests/e2e/debug.config.ts"
fi

# Build grep pattern from spec filter
GREP_ARG=""
if [[ -n "$SPEC_FILTER" ]]; then
  GREP_ARG="--grep $SPEC_FILTER"
fi

echo "╔══════════════════════════════════════════════════╗"
echo "║  Recursive Playwright Test Runner               ║"
echo "╠══════════════════════════════════════════════════╣"
echo "║  Config:      $(basename "$CONFIG")"
echo "║  Filter:      ${SPEC_FILTER:-all tests}"
echo "║  Max loops:   $MAX_ITERATIONS"
echo "║  Auto-retry:  $AUTO_RETRY"
echo "║  Debug mode:  $USE_DEBUG"
echo "╚══════════════════════════════════════════════════╝"
echo ""

iteration=0
total_passed=0
total_failed=0
failures_log="$RESULTS_DIR/failure-history.log"

mkdir -p "$RESULTS_DIR"
echo "=== Recursive run started at $(date -u +"%Y-%m-%dT%H:%M:%SZ") ===" > "$failures_log"

while [[ $iteration -lt $MAX_ITERATIONS ]]; do
  iteration=$((iteration + 1))
  echo ""
  echo "┌─────────────────────────────────────────────────┐"
  echo "│  Iteration $iteration / $MAX_ITERATIONS"
  echo "└─────────────────────────────────────────────────┘"
  echo ""

  # Run Playwright
  set +e
  npx playwright test \
    --config "$CONFIG" \
    $GREP_ARG \
    --reporter=list 2>&1 | tee "$RESULTS_DIR/iteration-$iteration.log"
  EXIT_CODE=${PIPESTATUS[0]}
  set -e

  # Parse results from output
  passed=$(grep -oP '\d+ passed' "$RESULTS_DIR/iteration-$iteration.log" | grep -oP '\d+' || echo "0")
  failed=$(grep -oP '\d+ failed' "$RESULTS_DIR/iteration-$iteration.log" | grep -oP '\d+' || echo "0")
  skipped=$(grep -oP '\d+ skipped' "$RESULTS_DIR/iteration-$iteration.log" | grep -oP '\d+' || echo "0")

  total_passed=$((total_passed + passed))
  total_failed=$((total_failed + failed))

  echo ""
  echo "  Results: ✅ $passed passed | ❌ $failed failed | ⏭️  $skipped skipped"
  echo "  Iteration $iteration: passed=$passed failed=$failed" >> "$failures_log"

  # All green — exit loop
  if [[ "$EXIT_CODE" -eq 0 ]]; then
    echo ""
    echo "╔══════════════════════════════════════════════════╗"
    echo "║  ✅ ALL TESTS PASSED (iteration $iteration)         ║"
    echo "╚══════════════════════════════════════════════════╝"
    echo ""
    echo "  Total across iterations: $total_passed passed, $total_failed failed"
    exit 0
  fi

  # Failures — analyze
  echo ""
  echo "  ── Failure Analysis ──"
  echo ""

  # Extract failed test names
  grep -E "^\s+\d+\)" "$RESULTS_DIR/iteration-$iteration.log" 2>/dev/null || true

  # Check for trace files
  trace_count=$(find "$RESULTS_DIR" -name "trace.zip" -newer "$RESULTS_DIR/iteration-$iteration.log" 2>/dev/null | wc -l | tr -d ' ')
  if [[ "$trace_count" -gt 0 ]]; then
    echo ""
    echo "  📦 $trace_count trace(s) captured. View with:"
    echo "     npx playwright show-trace $RESULTS_DIR/<test-name>/trace.zip"
  fi

  # Check for screenshots
  screenshot_count=$(find "$RESULTS_DIR" -name "*.png" -newer "$RESULTS_DIR/iteration-$iteration.log" 2>/dev/null | wc -l | tr -d ' ')
  if [[ "$screenshot_count" -gt 0 ]]; then
    echo "  📸 $screenshot_count screenshot(s) captured in $RESULTS_DIR/"
  fi

  echo ""
  echo "  🔍 Debug commands:"
  echo "     npx playwright show-report            # HTML report"
  echo "     npx playwright test --debug $GREP_ARG  # Step-through debugger"
  echo "     npx playwright test --ui $GREP_ARG     # Interactive UI mode"
  echo ""

  # Auto-retry or prompt
  if [[ "$AUTO_RETRY" == "true" ]]; then
    echo "  Auto-retrying in 2 seconds..."
    sleep 2
    continue
  fi

  # Check if running in non-interactive mode (CI)
  if [[ ! -t 0 ]]; then
    echo "  Non-interactive mode — exiting with failures."
    exit 1
  fi

  echo "  Options:"
  echo "    [r] Retry all failed tests"
  echo "    [d] Switch to debug mode and retry"
  echo "    [t] Open trace viewer"
  echo "    [h] Open HTML report"
  echo "    [q] Quit"
  echo ""
  read -r -p "  Choice [r/d/t/h/q]: " choice

  case "$choice" in
    r|R)
      echo "  Retrying..."
      continue
      ;;
    d|D)
      USE_DEBUG="true"
      CONFIG="$PROJECT_ROOT/tests/e2e/debug.config.ts"
      echo "  Switching to debug mode..."
      continue
      ;;
    t|T)
      latest_trace=$(find "$RESULTS_DIR" -name "trace.zip" -print0 | xargs -0 ls -t 2>/dev/null | head -1)
      if [[ -n "$latest_trace" ]]; then
        npx playwright show-trace "$latest_trace"
      else
        echo "  No traces found."
      fi
      continue
      ;;
    h|H)
      npx playwright show-report
      continue
      ;;
    q|Q)
      echo "  Exiting."
      exit 1
      ;;
    *)
      echo "  Unknown option. Retrying..."
      continue
      ;;
  esac
done

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  ❌ MAX ITERATIONS REACHED ($MAX_ITERATIONS)              ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
echo "  Total: $total_passed passed, $total_failed failed across $iteration iterations"
echo "  Failure log: $failures_log"
echo ""
echo "  Next steps:"
echo "    1. npx playwright show-report     # Review HTML report"
echo "    2. npx playwright test --debug    # Step through failures"
echo "    3. Check $failures_log for patterns"
exit 1
