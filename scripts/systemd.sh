#!/usr/bin/env bash
set -euo pipefail

# Sapphire — systemd service installer
# Usage: sudo bash scripts/systemd.sh [OPTIONS]
#
# Creates and enables a systemd unit so Sapphire starts on boot and
# can be managed with: systemctl start|stop|restart|status sapphire

SERVICE_NAME="sapphire"
PORT=3000
USER="${SUDO_USER:-$(whoami)}"

# ---------- helpers ----------

red()    { printf '\033[1;31m%s\033[0m\n' "$*"; }
green()  { printf '\033[1;32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[1;33m%s\033[0m\n' "$*"; }
info()   { printf '  %s\n' "$*"; }

fail() { red "Error: $*"; exit 1; }

# ---------- parse args ----------

UNINSTALL=false
for arg in "$@"; do
  case "$arg" in
    --port=*)      PORT="${arg#*=}" ;;
    --user=*)      USER="${arg#*=}" ;;
    --name=*)      SERVICE_NAME="${arg#*=}" ;;
    --uninstall)   UNINSTALL=true ;;
    --help|-h)
      cat <<EOF
Usage: sudo bash scripts/systemd.sh [OPTIONS]

Options:
  --port=PORT      Port for the server (default: 3000)
  --user=USER      User to run the service as (default: current user)
  --name=NAME      Service name (default: sapphire)
  --uninstall      Remove the systemd service
  -h, --help       Show this help
EOF
      exit 0
      ;;
  esac
done

# ---------- checks ----------

if [ "$(id -u)" -ne 0 ]; then
  fail "This script must be run as root (use sudo)."
fi

id "$USER" >/dev/null 2>&1 || fail "User '$USER' does not exist."

UNIT_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

# ---------- uninstall ----------

if [ "$UNINSTALL" = true ]; then
  if [ ! -f "$UNIT_FILE" ]; then
    fail "Service '$SERVICE_NAME' is not installed."
  fi
  info "Stopping service..."
  systemctl stop "$SERVICE_NAME" 2>/dev/null || true
  systemctl disable "$SERVICE_NAME" 2>/dev/null || true
  rm -f "$UNIT_FILE"
  systemctl daemon-reload
  green "Service '$SERVICE_NAME' removed."
  exit 0
fi

# ---------- detect paths ----------

# Resolve the Sapphire project directory (parent of scripts/)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ ! -f "$APP_DIR/package.json" ] || ! grep -q '"sapphire"' "$APP_DIR/package.json" 2>/dev/null; then
  fail "Cannot find Sapphire project at $APP_DIR"
fi

# Find node and npm — check system PATH first, then common version-manager locations
NODE_BIN="$(command -v node 2>/dev/null || true)"
NPM_BIN="$(command -v npm 2>/dev/null || true)"

if [ -z "$NODE_BIN" ]; then
  USER_HOME="$(eval echo "~$USER")"
  for candidate in \
    "$USER_HOME/.nvm/current/bin/node" \
    "$USER_HOME/.local/share/fnm/aliases/default/bin/node" \
    "/usr/local/bin/node"; do
    if [ -x "$candidate" ]; then
      NODE_BIN="$candidate"
      NPM_BIN="$(dirname "$candidate")/npm"
      break
    fi
  done
  # nvm without 'current' symlink — find the default alias
  if [ -z "$NODE_BIN" ] && [ -d "$USER_HOME/.nvm/versions/node" ]; then
    NVM_DEFAULT="$(ls -1d "$USER_HOME/.nvm/versions/node/"v* 2>/dev/null | sort -V | tail -1)"
    if [ -n "$NVM_DEFAULT" ] && [ -x "$NVM_DEFAULT/bin/node" ]; then
      NODE_BIN="$NVM_DEFAULT/bin/node"
      NPM_BIN="$NVM_DEFAULT/bin/npm"
    fi
  fi
fi

[ -n "$NODE_BIN" ] || fail "Cannot find node binary. Install Node.js or use --user=USER where USER has node installed."

NODE_DIR="$(dirname "$NODE_BIN")"

# ---------- write unit ----------

info "Installing systemd service: $SERVICE_NAME"
info "  App directory: $APP_DIR"
info "  User: $USER"
info "  Port: $PORT"
info "  Node: $NODE_BIN"

cat > "$UNIT_FILE" <<EOF
[Unit]
Description=Sapphire Photo Gallery
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$APP_DIR
ExecStart=$NPM_BIN start -- --port $PORT
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=$PORT
Environment=PATH=$NODE_DIR:/usr/local/bin:/usr/bin:/bin
EnvironmentFile=-$APP_DIR/.env

# Hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=$APP_DIR/data
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

# ---------- enable & start ----------

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

# Brief wait then check status
sleep 2
if systemctl is-active --quiet "$SERVICE_NAME"; then
  green "Sapphire is running on port $PORT"
else
  yellow "Service started but may not be ready yet. Check:"
  info "  systemctl status $SERVICE_NAME"
  info "  journalctl -u $SERVICE_NAME -f"
fi

echo ""
info "Manage with:"
info "  systemctl status $SERVICE_NAME"
info "  systemctl restart $SERVICE_NAME"
info "  systemctl stop $SERVICE_NAME"
info "  journalctl -u $SERVICE_NAME -f    # live logs"
echo ""
info "Nginx reverse proxy (recommended):"
info "  cp scripts/nginx.conf /etc/nginx/sites-available/sapphire"
info "  Edit: replace YOUR_DOMAIN and /path/to/sapphire"
info "  ln -s /etc/nginx/sites-available/sapphire /etc/nginx/sites-enabled/"
info "  certbot --nginx -d YOUR_DOMAIN    # for HTTPS + HTTP/2"
info "  systemctl reload nginx"
echo ""
info "To remove: sudo bash scripts/systemd.sh --uninstall"
