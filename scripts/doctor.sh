#!/usr/bin/env sh
set -u

STRICT=0
if [ "${1:-}" = "--strict" ]; then
  STRICT=1
fi

missing=""
append_missing() {
  if [ -z "$missing" ]; then
    missing="$1"
  else
    missing="$missing $1"
  fi
}

if ! command -v cmake >/dev/null 2>&1; then
  append_missing "cmake"
fi

if ! command -v cargo >/dev/null 2>&1; then
  append_missing "cargo"
fi

if [ -z "$missing" ]; then
  echo "Doctor: OK"
  exit 0
fi

echo "Doctor: missing dependencies: $missing"

case "$(uname -s)" in
  Darwin)
    if echo "$missing" | grep -q "cmake"; then
      echo "Install CMake: brew install cmake"
    fi
    if echo "$missing" | grep -q "cargo"; then
      echo "Install Rust/Cargo: curl https://sh.rustup.rs -sSf | sh"
      echo "Then load PATH in current shell: source \"$HOME/.cargo/env\""
    fi
    ;;
  Linux)
    if echo "$missing" | grep -q "cmake"; then
      echo "Ubuntu/Debian: sudo apt-get install cmake"
      echo "Fedora: sudo dnf install cmake"
      echo "Arch: sudo pacman -S cmake"
    fi
    if echo "$missing" | grep -q "cargo"; then
      echo "Install Rust/Cargo via rustup: curl https://sh.rustup.rs -sSf | sh"
      echo "Then load PATH in current shell: source \"$HOME/.cargo/env\""
    fi
    ;;
  MINGW*|MSYS*|CYGWIN*)
    if echo "$missing" | grep -q "cmake"; then
      echo "Install: choco install cmake"
      echo "Or download from: https://cmake.org/download/"
    fi
    if echo "$missing" | grep -q "cargo"; then
      echo "Install Rust/Cargo from: https://www.rust-lang.org/tools/install"
    fi
    ;;
  *)
    if echo "$missing" | grep -q "cmake"; then
      echo "Install CMake from: https://cmake.org/download/"
    fi
    if echo "$missing" | grep -q "cargo"; then
      echo "Install Rust/Cargo from: https://www.rust-lang.org/tools/install"
    fi
    ;;
esac

if [ "$STRICT" -eq 1 ]; then
  exit 1
fi

exit 0
