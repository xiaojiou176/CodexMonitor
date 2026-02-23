#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

UPSTREAM_REMOTE=${UPSTREAM_REMOTE:-}
UPSTREAM_BRANCH=${UPSTREAM_BRANCH:-main}
VENDOR_BRANCH=${VENDOR_BRANCH:-vendor/upstream}
CUSTOM_BRANCH=${CUSTOM_BRANCH:-custom/main}
DRY_RUN=0
ALLOW_DIRTY=0

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Options:
  --dry-run                 Print planned actions only.
  --allow-dirty             Allow running with local uncommitted changes.
  --upstream-remote <name>  Upstream remote name (default: auto-detect upstream, fallback origin).
  --upstream-branch <name>  Upstream branch name (default: main).
  --vendor-branch <name>    Vendor mirror branch (default: vendor/upstream).
  --custom-branch <name>    Local custom patch branch (default: custom/main).
  -h, --help                Show help.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      ;;
    --allow-dirty)
      ALLOW_DIRTY=1
      ;;
    --upstream-remote)
      UPSTREAM_REMOTE=${2:-}
      shift
      ;;
    --upstream-branch)
      UPSTREAM_BRANCH=${2:-}
      shift
      ;;
    --vendor-branch)
      VENDOR_BRANCH=${2:-}
      shift
      ;;
    --custom-branch)
      CUSTOM_BRANCH=${2:-}
      shift
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

if [ -z "$UPSTREAM_BRANCH" ] || [ -z "$VENDOR_BRANCH" ] || [ -z "$CUSTOM_BRANCH" ]; then
  echo "Error: empty parameter is not allowed." >&2
  usage
  exit 1
fi

cd "$REPO_ROOT"

if [ -z "$UPSTREAM_REMOTE" ]; then
  if git remote get-url upstream >/dev/null 2>&1; then
    UPSTREAM_REMOTE=upstream
  elif git remote get-url origin >/dev/null 2>&1; then
    UPSTREAM_REMOTE=origin
  else
    echo "Error: could not auto-detect upstream remote (checked: upstream, origin)." >&2
    echo "Hint: pass --upstream-remote <name> explicitly." >&2
    exit 1
  fi
fi

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
IS_DIRTY=0
if [ -n "$(git status --porcelain)" ]; then
  IS_DIRTY=1
fi

run_cmd() {
  if [ "$DRY_RUN" -eq 1 ]; then
    echo "[dry-run] $*"
    return 0
  fi
  "$@"
}

echo "[sync-upstream] repo: $REPO_ROOT"
echo "[sync-upstream] current branch: $CURRENT_BRANCH"
echo "[sync-upstream] upstream: $UPSTREAM_REMOTE/$UPSTREAM_BRANCH"
echo "[sync-upstream] vendor branch: $VENDOR_BRANCH"
echo "[sync-upstream] custom branch: $CUSTOM_BRANCH"

if ! git remote get-url "$UPSTREAM_REMOTE" >/dev/null 2>&1; then
  echo "Error: remote '$UPSTREAM_REMOTE' not found." >&2
  echo "Hint: git remote add $UPSTREAM_REMOTE <url>" >&2
  exit 1
fi

if [ "$IS_DIRTY" -eq 1 ] && [ "$ALLOW_DIRTY" -ne 1 ] && [ "$DRY_RUN" -ne 1 ]; then
  echo "Error: working tree is dirty. Commit/stash changes first, or pass --allow-dirty." >&2
  exit 1
fi

echo "[sync-upstream] [1/5] fetch upstream"
run_cmd git fetch "$UPSTREAM_REMOTE"

echo "[sync-upstream] [2/5] update vendor mirror branch"
if git show-ref --verify --quiet "refs/heads/$VENDOR_BRANCH"; then
  run_cmd git switch "$VENDOR_BRANCH"
else
  run_cmd git switch -c "$VENDOR_BRANCH" "$UPSTREAM_REMOTE/$UPSTREAM_BRANCH"
fi
run_cmd git reset --hard "$UPSTREAM_REMOTE/$UPSTREAM_BRANCH"

echo "[sync-upstream] [3/5] ensure custom branch exists"
if git show-ref --verify --quiet "refs/heads/$CUSTOM_BRANCH"; then
  run_cmd git switch "$CUSTOM_BRANCH"
else
  echo "Error: custom branch '$CUSTOM_BRANCH' does not exist." >&2
  echo "Hint: git switch -c $CUSTOM_BRANCH $VENDOR_BRANCH" >&2
  exit 1
fi

echo "[sync-upstream] [4/5] rebase custom patches on vendor base"
run_cmd git rebase "$VENDOR_BRANCH"

echo "[sync-upstream] [5/5] return to original branch"
run_cmd git switch "$CURRENT_BRANCH"

echo "[sync-upstream] done"
