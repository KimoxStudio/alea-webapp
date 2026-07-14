#!/usr/bin/env bash
# Instala los git hooks locales del proyecto.
# Ejecutar una vez tras clonar: pnpm hooks:install

set -euo pipefail


# `--git-path hooks` resolves the shared hooks directory correctly, both in a
# normal checkout and inside a `git worktree` (where `.git` is a file that
# points at a per-worktree git dir under `.git/worktrees/<name>`, which does
# NOT have a `hooks/` folder git actually reads). `--git-dir` would resolve to
# that per-worktree dir and silently install a hook Git never runs.
HOOKS_DIR="$(git rev-parse --git-path hooks)"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MANAGED_MARKER="# alea-webapp-managed-hook"

install_hook() {
  local name="$1"
  local target="$HOOKS_DIR/$name"

  if [[ -f "$target" ]] && ! grep -Fq "$MANAGED_MARKER" "$target"; then
    echo "Hook already exists and is not managed by alea-webapp: $target"
    echo "Skipping installation to avoid overwriting an existing hook."
    return 0
  fi

  cat > "$target" <<HOOK
#!/usr/bin/env bash
$MANAGED_MARKER
exec "$SCRIPT_DIR/ci-local.sh"
HOOK
  chmod +x "$target"
  echo "✓ Hook instalado: $name"
}

chmod +x "$SCRIPT_DIR/ci-local.sh"
install_hook "pre-push"

echo ""
echo "Hooks instalados correctamente."
echo "El CI local se ejecutará antes de cada 'git push' solo si el hook quedó instalado."
echo "Para saltarlo puntualmente: git push --no-verify"
