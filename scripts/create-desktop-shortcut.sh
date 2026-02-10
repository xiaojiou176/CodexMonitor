#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
DESKTOP_DIR=${DESKTOP_DIR:-"$HOME/Desktop"}

mkdir -p "$DESKTOP_DIR"

case "$(uname -s)" in
  Darwin)
    TARGET="$DESKTOP_DIR/CodexMonitor-Dev.command"
    cat > "$TARGET" <<EOT
#!/usr/bin/env bash
set -euo pipefail
cd "$REPO_ROOT"
exec bash scripts/start-dev.sh
EOT
    chmod +x "$TARGET"
    echo "✅ Desktop shortcut created: $TARGET"
    echo "Double-click it to open Terminal and start CodexMonitor in dev mode."
    ;;
  Linux)
    TARGET="$DESKTOP_DIR/CodexMonitor-Dev.desktop"
    cat > "$TARGET" <<EOT
[Desktop Entry]
Type=Application
Version=1.0
Name=CodexMonitor Dev
Comment=Start CodexMonitor in development mode
Terminal=true
Exec=bash -lc 'cd "$REPO_ROOT" && ./scripts/start-dev.sh'
Path=$REPO_ROOT
Icon=$REPO_ROOT/icon.png
Categories=Development;
EOT
    chmod +x "$TARGET"
    echo "✅ Desktop shortcut created: $TARGET"
    ;;
  *)
    echo "❌ Unsupported OS for desktop shortcut: $(uname -s)"
    echo "You can still launch manually with:"
    echo "  cd \"$REPO_ROOT\" && ./scripts/start-dev.sh"
    exit 1
    ;;
esac
