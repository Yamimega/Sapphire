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

# ---------- mode ----------

MODE="install"
PORT=3000
for arg in "$@"; do
  case "$arg" in
    --update|-u) MODE="update" ;;
    --port=*)    PORT="${arg#*=}" ;;
    --dir=*)     DIR="${arg#*=}" ;;
    --help|-h)
      echo "Usage: install.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --update, -u     Update an existing installation"
      echo "  --dir=NAME       Directory name (default: sapphire)"
      echo "  --port=PORT      Port for production server (default: 3000)"
      echo "  -h, --help       Show this help"
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
  npm install --production=false

  info "Setting up database..."
  npx drizzle-kit generate 2>/dev/null || true
  npx drizzle-kit migrate

  info "Building for production..."
  npm run build

  # Create .env if missing
  if [ ! -f .env ]; then
    cat > .env << 'ENVEOF'
SAPPHIRE_PASSWORD=changeme

# Watermark settings (applied to non-downloadable galleries for guests)
SAPPHIRE_WATERMARK_ENABLED=true
SAPPHIRE_WATERMARK_TEXT=PROTECTED
SAPPHIRE_WATERMARK_OPACITY=0.3
SAPPHIRE_WATERMARK_COLOR=white
SAPPHIRE_WATERMARK_STYLE=diagonal

# Image URL token expiration (seconds)
# SAPPHIRE_IMAGE_TOKEN_TTL=3600
ENVEOF
    yellow "Created .env with default password 'changeme' — change it!"
  fi

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
    # Try entering the directory
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
  npm install --production=false

  info "Running database migrations..."
  npx drizzle-kit generate 2>/dev/null || true
  npx drizzle-kit migrate

  info "Rebuilding..."
  npm run build

  echo ""
  green "Sapphire updated successfully!"
  info "Restart the server to apply changes: npm start"
fi
