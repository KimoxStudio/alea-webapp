#!/usr/bin/env bash
# Smoke test for scripts/install-hooks.sh: proves the pre-push hook actually
# gets installed (in a location Git will run) when `pnpm hooks:install` is
# executed from inside a `git worktree`, not just from a normal checkout.
#
# Runs entirely against a throwaway scratch repo in a temp directory, so it
# never touches this project's real .git state or any existing hooks.
#
# Run manually with: bash scripts/verify-hooks-worktree.sh

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; exit 1; }
step() { echo -e "\n${YELLOW}▶${NC} $1"; }

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP_ROOT="$(mktemp -d)"
SCRATCH_REPO="$TMP_ROOT/scratch-repo"
SCRATCH_WORKTREE="$TMP_ROOT/scratch-worktree"

cleanup() {
  rm -rf "$TMP_ROOT"
}
trap cleanup EXIT

echo -e "\n${YELLOW}━━━ hooks:install worktree smoke test ━━━${NC}"

step "Creating an isolated scratch git repo (does not touch this project's real .git)"
mkdir -p "$SCRATCH_REPO/scripts"
git init -q "$SCRATCH_REPO"
git -C "$SCRATCH_REPO" config user.email "smoke-test@alea-webapp.local"
git -C "$SCRATCH_REPO" config user.name "Smoke Test"
cp "$REPO_ROOT/scripts/install-hooks.sh" "$SCRATCH_REPO/scripts/install-hooks.sh"
cp "$REPO_ROOT/scripts/ci-local.sh" "$SCRATCH_REPO/scripts/ci-local.sh"
git -C "$SCRATCH_REPO" add scripts
git -C "$SCRATCH_REPO" commit -q -m "scratch: seed hooks scripts"
pass "scratch repo created at $SCRATCH_REPO"

step "Adding a git worktree off the scratch repo"
git -C "$SCRATCH_REPO" worktree add -q --detach "$SCRATCH_WORKTREE" HEAD
pass "worktree created at $SCRATCH_WORKTREE"

step "Running install-hooks.sh from inside the worktree"
(cd "$SCRATCH_WORKTREE" && bash "$SCRATCH_WORKTREE/scripts/install-hooks.sh" >/dev/null)
pass "install-hooks.sh exited successfully"

step "Verifying the hook landed where Git will actually look for it"
EXPECTED_HOOK="$(cd "$SCRATCH_WORKTREE" && git rev-parse --git-path hooks)/pre-push"
if [[ ! -f "$EXPECTED_HOOK" ]]; then
  fail "pre-push hook not found at $EXPECTED_HOOK"
fi
if [[ ! -x "$EXPECTED_HOOK" ]]; then
  fail "pre-push hook at $EXPECTED_HOOK is not executable"
fi
if ! grep -Fq "alea-webapp-managed-hook" "$EXPECTED_HOOK"; then
  fail "pre-push hook at $EXPECTED_HOOK is missing the managed marker"
fi
pass "pre-push hook correctly installed at $EXPECTED_HOOK"

step "Sanity check: the per-worktree git-dir would NOT have contained the hook"
WORKTREE_PRIVATE_GIT_DIR="$(cd "$SCRATCH_WORKTREE" && git rev-parse --git-dir)"
if [[ -f "$WORKTREE_PRIVATE_GIT_DIR/hooks/pre-push" ]]; then
  fail "unexpected: hook found under the per-worktree git-dir ($WORKTREE_PRIVATE_GIT_DIR/hooks); this would mean Git never runs it"
fi
pass "confirmed the per-worktree git-dir has no hooks/pre-push (this is what --git-dir would have wrongly targeted)"

echo -e "\n${GREEN}━━━ hooks:install worktree smoke test passed ✓ ━━━${NC}\n"
