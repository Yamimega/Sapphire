#!/usr/bin/env bash
set -euo pipefail

# Sapphire — Install & Update Script
# Install:  curl -fsSL https://raw.githubusercontent.com/Yamimega/Sapphire/master/scripts/install.sh | bash
# Update:   curl -fsSL https://raw.githubusercontent.com/Yamimega/Sapphire/master/scripts/install.sh | bash -s -- --update

REPO="https://github.com/Yamimega/Sapphire.git"
DIR="sapphire"
BRANCH="master"
MIN_NODE=20

# ---------- helpers ----------

red()    { printf '\033[1;31m%s\033[0m\n' "$*"; }
green()  { printf '\033[1;32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[1;33m%s\033[0m\n' "$*"; }
info()   { printf '  %s\n' "$*"; }

fail() { red "Error: $*"; exit 1; }

check_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "'$1' is required but not installed."
}

# ---------- preflight ----------

check_cmd git
check_cmd node
check_cmd npm

NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VER" -lt "$MIN_NODE" ]; then
  fail "Node.js $MIN_NODE+ required (found $(node -v))."
fi

# ---------- parse args ----------

MODE="install"
PORT=3000
for arg in "$@"; do
  case "$arg" in
    --update|-u) MODE="update" ;;
    --port=*)    PORT="${arg#*=}" ;;
    --dir=*)     DIR="${arg#*=}" ;;
    --help|-h)
      cat <<EOF
Usage: install.sh [OPTIONS]

Options:
  --update, -u     Update an existing installation
  --dir=NAME       Directory name (default: sapphire)
  --port=PORT      Port for production server (default: 3000)
  -h, --help       Show this help
EOF
      exit 0
      ;;
  esac
done

# ---------- install ----------

if [ "$MODE" = "install" ]; then
  green "Installing Sapphire..."

  if [ -d "$DIR" ]; then
    fail "Directory '$DIR' already exists. Use --update to update, or remove it first."
  fi

  git clone --depth 1 -b "$BRANCH" "$REPO" "$DIR"
  cd "$DIR"

  info "Installing dependencies..."
  npm ci --ignore-scripts 2>/dev/null || npm install
  npm rebuild 2>/dev/null || true

  info "Setting up environment and database..."
  npm run setup

  info "Building for production..."
  npm run build

  yellow "Default password is 'changeme' — edit .env to change it!"
  echo ""
  green "Sapphire installed successfully!"
  echo ""
  info "Next steps:"
  info "  cd $DIR"
  info "  nano .env            # set your admin password"
  info "  npm start            # start on port $PORT"
  echo ""
  info "Then open http://localhost:$PORT"

# ---------- update ----------

elif [ "$MODE" = "update" ]; then
  green "Updating Sapphire..."

  if [ ! -f "package.json" ] || ! grep -q '"sapphire"' package.json 2>/dev/null; then
    if [ -d "$DIR" ]; then
      cd "$DIR"
    fi
    if [ ! -f "package.json" ] || ! grep -q '"sapphire"' package.json 2>/dev/null; then
      fail "Not in a Sapphire directory. Run from the install location or use --dir=NAME."
    fi
  fi

  # Stash any local changes to tracked files
  if ! git diff --quiet 2>/dev/null; then
    yellow "Stashing local changes..."
    git stash
  fi

  info "Pulling latest changes..."
  git pull origin "$BRANCH"

  info "Installing dependencies..."
  npm ci --ignore-scripts 2>/dev/null || npm install
  npm rebuild 2>/dev/null || true

  info "Running database migrations..."
  npx drizzle-kit generate 2>/dev/null || true
  npx drizzle-kit migrate

  info "Rebuilding..."
  npm run build

  echo ""
  green "Sapphire updated successfully!"
  info "Restart the server to apply changes: npm start"
fi
