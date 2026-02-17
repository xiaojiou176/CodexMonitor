#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

UPSTREAM_REMOTE=${UPSTREAM_REMOTE:-upstream}
UPSTREAM_BRANCH=${UPSTREAM_BRANCH:-main}
CUSTOM_BRANCH=${CUSTOM_BRANCH:-custom/main}
BASELINE_RANGE=${BASELINE_RANGE:-}
SKIP_GATES=0

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Options:
  --upstream-remote <name>  Upstream remote name (default: upstream).
  --upstream-branch <name>  Upstream branch name (default: main).
  --custom-branch <name>    Custom branch name (default: custom/main).
  --baseline-range <range>  Previous baseline for range-diff (example: abc123..def456).
  --skip-gates              Skip lint/typecheck/test/cargo check.
  -h, --help                Show help.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --upstream-remote)
      UPSTREAM_REMOTE=${2:-}
      shift
      ;;
    --upstream-branch)
      UPSTREAM_BRANCH=${2:-}
      shift
      ;;
    --custom-branch)
      CUSTOM_BRANCH=${2:-}
      shift
      ;;
    --baseline-range)
      BASELINE_RANGE=${2:-}
      shift
      ;;
    --skip-gates)
      SKIP_GATES=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
  shift
done

if [ -z "$UPSTREAM_REMOTE" ] || [ -z "$UPSTREAM_BRANCH" ] || [ -z "$CUSTOM_BRANCH" ]; then
  echo "Error: empty parameter is not allowed." >&2
  usage
  exit 1
fi

cd "$REPO_ROOT"

echo "[sync-verify] repo: $REPO_ROOT"
echo "[sync-verify] upstream base: $UPSTREAM_REMOTE/$UPSTREAM_BRANCH"
echo "[sync-verify] custom branch: $CUSTOM_BRANCH"

if ! git remote get-url "$UPSTREAM_REMOTE" >/dev/null 2>&1; then
  echo "Error: remote '$UPSTREAM_REMOTE' not found." >&2
  exit 1
fi

if ! git show-ref --verify --quiet "refs/heads/$CUSTOM_BRANCH"; then
  echo "Error: branch '$CUSTOM_BRANCH' not found." >&2
  exit 1
fi

echo "[sync-verify] [1/4] branch divergence"
git fetch "$UPSTREAM_REMOTE" >/dev/null 2>&1 || true
git rev-list --left-right --count "$UPSTREAM_REMOTE/$UPSTREAM_BRANCH...$CUSTOM_BRANCH" | awk '{print "  behind=" $1 ", ahead=" $2}'

echo "[sync-verify] [2/4] diff stats"
git diff --shortstat "$UPSTREAM_REMOTE/$UPSTREAM_BRANCH..$CUSTOM_BRANCH" || true
echo "  top directories:"
git diff --dirstat=files,0 "$UPSTREAM_REMOTE/$UPSTREAM_BRANCH..$CUSTOM_BRANCH" | sed -n '1,20p' || true

echo "[sync-verify] [3/4] patch-shape check"
if [ -n "$BASELINE_RANGE" ]; then
  git range-diff "$BASELINE_RANGE" "$UPSTREAM_REMOTE/$UPSTREAM_BRANCH..$CUSTOM_BRANCH" || true
else
  echo "  baseline-range not provided; skip range-diff."
fi

echo "[sync-verify] [4/4] quality gates"
if [ "$SKIP_GATES" -eq 1 ]; then
  echo "  skip gates enabled."
  exit 0
fi

npm run lint
npm run typecheck
npm run test
(
  cd src-tauri
  cargo check
)

echo "[sync-verify] done"

