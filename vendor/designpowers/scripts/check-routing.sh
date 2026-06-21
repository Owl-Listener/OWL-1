#!/usr/bin/env bash
# Routing-contract check.
#
# Verifies the routing fixtures in tests/routing-fixtures.md against the router:
# for every fixture, the expected skill must (a) exist as a skills/<x> dir and
# (b) be referenced as a trigger in skills/using-designpowers/SKILL.md.
#
# This is the regression net for routing: when the router changes (new lanes,
# refactored welcome, externalised sections), this fails if any scenario's
# target skill is dropped or orphaned. It is a STATIC contract check, not a live
# simulation of the model — see tests/routing-fixtures.md for that distinction.
#
# Exits non-zero on any problem so CI can gate on it. Pure bash + grep.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ROUTER="$ROOT/skills/using-designpowers/SKILL.md"
FIX="$ROOT/tests/routing-fixtures.md"
fail=0
note() { echo "  $*"; }

[ -f "$ROUTER" ] || { echo "ERROR: router not found at $ROUTER" >&2; exit 2; }
[ -f "$FIX" ]    || { echo "ERROR: fixtures not found at $FIX" >&2; exit 2; }

# Pull fixture rows: table lines with exactly three pipe-separated columns whose
# 2nd column is a skill slug. Skip the header row, the separator row, the
# format-spec line, and anything inside an HTML comment (e.g. the v2 examples).
checked=0
in_comment=0
while IFS= read -r raw; do
  # track HTML comment blocks and skip their contents
  case "$raw" in
    *"<!--"*) in_comment=1 ;;
  esac
  if [ "$in_comment" -eq 1 ]; then
    case "$raw" in *"-->"*) in_comment=0 ;; esac
    continue
  fi
  case "$raw" in '|'*) : ;; *) continue ;; esac          # table rows only
  case "$raw" in *---*) continue ;; esac                  # skip |---|---| separator
  IFS='|' read -r _ prompt skill rationale _rest <<EOF
$raw
EOF
  prompt="$(echo "$prompt" | sed 's/^ *//;s/ *$//')"
  skill="$(echo "$skill" | sed 's/^ *//;s/ *$//')"
  # only rows whose 2nd column is a bare lowercase slug (the fixtures)
  case "$skill" in
    expected_skill|"") continue ;;
    *[!a-z0-9-]*) continue ;;
  esac
  checked=$((checked+1))
  problem=""
  [ -d "$ROOT/skills/$skill" ] || problem="no skills/$skill dir"
  if [ -z "$problem" ] && ! grep -q "\`$skill\`" "$ROUTER"; then
    problem="skills/$skill exists but is not referenced (orphaned) in the router"
  fi
  if [ -n "$problem" ]; then
    note "BROKEN: \"$prompt\" -> $skill ($problem)"
    fail=1
  fi
done < "$FIX"

echo "Routing fixtures checked: $checked"
if [ "$checked" -eq 0 ]; then
  echo "ERROR: no fixtures parsed — check the fixtures table format." >&2
  exit 2
fi

echo ""
if [ "$fail" -ne 0 ]; then
  echo "FAIL — one or more routing fixtures point at a missing/orphaned skill."
  echo "Either restore the skill+trigger, or update tests/routing-fixtures.md if the routing intentionally changed."
  exit 1
fi
echo "OK — every routing fixture targets a real, wired skill."
