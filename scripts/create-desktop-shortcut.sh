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
#!/bin/zsh
set -euo pipefail

# CodexMonitor launcher with selectable run mode.
# Mode options:
#   1) Dev mode (npm run tauri:dev)
#   2) Release mode (launch existing app bundle)
#   3) Build release + launch

REPO_DIR="$REPO_ROOT"
LOG_DIR="\$REPO_DIR/.runtime-cache/test_output/launchers"
LOG_FILE="\$LOG_DIR/codex-monitor-launch.log"
mkdir -p "\$LOG_DIR"

{
  echo "╔════════════════════════════════════════════════════╗"
  echo "║  Launch-CodexMonitor  \$(date '+%Y-%m-%d %H:%M:%S')  ║"
  echo "╚════════════════════════════════════════════════════╝"
  echo ""

  if [ ! -d "\$REPO_DIR" ]; then
    echo "❌ Repo not found: \$REPO_DIR"
    exit 1
  fi
  cd "\$REPO_DIR"

  if ! command -v npm >/dev/null 2>&1; then
    echo "❌ npm not found in PATH."
    exit 1
  fi

  echo "[模式选择] 请选择启动方式："
  echo "  1) Dev 模式（tauri dev）"
  echo "  2) Release 模式（直接打开已构建 App）"
  echo "  3) Build + Release（先构建再打开）"

  MODE="1"
  if read -r "USER_MODE?请输入 1/2/3（默认 1）: "; then
    USER_MODE="\$(echo "\${USER_MODE:-}" | tr -d '[:space:]')"
    if [ -n "\${USER_MODE:-}" ]; then
      MODE="\$USER_MODE"
    fi
  fi

  APP_PATH=""
  if [ -d "src-tauri/target/release/bundle/macos/Codex Monitor.app" ]; then
    APP_PATH="src-tauri/target/release/bundle/macos/Codex Monitor.app"
  elif [ -d "src-tauri/target/release/bundle/macos/CodexMonitor.app" ]; then
    APP_PATH="src-tauri/target/release/bundle/macos/CodexMonitor.app"
  fi

  case "\$MODE" in
    1)
      echo ""
      echo "[1/1] 启动 Dev 模式..."
      exec bash scripts/start-dev.sh
      ;;
    2)
      echo ""
      echo "[1/1] 启动 Release 模式..."
      if [ -z "\$APP_PATH" ]; then
        echo "❌ 未找到 release app。请先执行模式 3 构建。"
        exit 1
      fi
      echo "✅ 打开: \$APP_PATH"
      open -na "\$APP_PATH"
      ;;
    3)
      echo ""
      echo "[1/3] 检查依赖..."
      if [ ! -d node_modules ]; then
        echo "📦 node_modules not found; running npm install..."
        npm install
      fi
      echo "[2/3] 构建 Release..."
      set +e
      npm run tauri:build
      BUILD_EXIT=$?
      set -e
      if [ -d "src-tauri/target/release/bundle/macos/Codex Monitor.app" ]; then
        APP_PATH="src-tauri/target/release/bundle/macos/Codex Monitor.app"
      elif [ -d "src-tauri/target/release/bundle/macos/CodexMonitor.app" ]; then
        APP_PATH="src-tauri/target/release/bundle/macos/CodexMonitor.app"
      else
        echo "❌ 构建完成但未找到 app bundle。"
        exit 1
      fi
      if [ "\$BUILD_EXIT" -ne 0 ]; then
        echo "⚠️ tauri:build 返回非零，但检测到 app bundle 已生成。"
        echo "   常见原因：启用了 updater 公钥，但本地未配置 TAURI_SIGNING_PRIVATE_KEY。"
        echo "   将继续启动本地 Release App。"
      fi
      echo "[3/3] 启动 Release App..."
      echo "✅ 打开: \$APP_PATH"
      open -na "\$APP_PATH"
      ;;
    *)
      echo "⚠️ 输入无效，默认进入 Dev 模式。"
      exec bash scripts/start-dev.sh
      ;;
  esac

  echo ""
  echo "✅ 完成。日志: \$LOG_FILE"
  echo "5秒后自动关闭窗口..."
  sleep 5
} 2>&1 | tee "\$LOG_FILE"
EOT
    chmod +x "$TARGET"
    echo "✅ Desktop shortcut created: $TARGET"
    echo "Double-click it to choose Dev / Release / Build+Release launch mode."
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
