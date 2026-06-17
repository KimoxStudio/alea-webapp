#!/usr/bin/env bash
# Local CI — runs before git push only if the pre-push hook was installed (for example via `pnpm hooks:install`)
# Skip with: git push --no-verify

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; exit 1; }
step() { echo -e "\n${YELLOW}▶${NC} $1"; }

echo -e "\n${YELLOW}━━━ CI local — Alea Webapp ━━━${NC}"

step "Typecheck"
rm -rf .next/types .next/cache/.tsbuildinfo
pnpm typecheck && pass "typecheck" || fail "typecheck falló"

step "Lint"
pnpm lint && pass "lint" || fail "lint falló"

# Full test suite and build run in CI (GitHub Actions), not locally on push.
# Run manually: pnpm test && pnpm build

echo -e "\n${GREEN}━━━ CI local pasado ✓ ━━━${NC}\n"
