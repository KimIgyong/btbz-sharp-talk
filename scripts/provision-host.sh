#!/usr/bin/env bash
# Bootstrap a fresh Ubuntu 22.04/24.04 host for a SharpTalk deployment (PLN-260913
# Production-Provisioning-Deploy C1). Idempotent: safe to re-run; every step checks
# before it changes anything.
#
#   sudo bash scripts/provision-host.sh --domain sharptalk.example.com --email ops@example.com \
#        [--user sharptalk] [--ssh-allow 1.2.3.4/32] [--swap 4G] [--no-tls]
#   sudo bash scripts/provision-host.sh --domain … --check     # verify only, change nothing
#
# What it does (Basic setup guide §3, self-hosted install guide §1):
#   1. apt update, base tools, UTC + chrony, unattended-upgrades
#   2. Docker Engine + Compose v2 from Docker's repository
#   3. deploy user (docker group) + ~/sharptalk directory
#   4. UFW: 22 (optionally restricted to --ssh-allow), 80, 443; deny the rest
#   5. host nginx vhost <domain> → 127.0.0.1:${HTTP_PORT:-8080} (WebSocket, 25m body)
#   6. certbot --nginx -d <domain>   (never --redirect: it would rewrite sibling vhosts)
#   7. optional swap file (builds need ~8GB RAM; add swap on smaller hosts)
#
# It does NOT clone the repo, write .env, or deploy — those follow with
# scripts/deploy-self-hosted.sh as the deploy user (Basic setup guide §4).
set -euo pipefail

DOMAIN=""; EMAIL=""; DEPLOY_USER="sharptalk"; SSH_ALLOW=""; SWAP=""; CHECK=0; TLS=1; HTTP_PORT="${HTTP_PORT:-8080}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --email) EMAIL="$2"; shift 2 ;;
    --user) DEPLOY_USER="$2"; shift 2 ;;
    --ssh-allow) SSH_ALLOW="$2"; shift 2 ;;
    --swap) SWAP="$2"; shift 2 ;;
    --http-port) HTTP_PORT="$2"; shift 2 ;;
    --no-tls) TLS=0; shift ;;
    --check) CHECK=1; shift ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done
[[ -n "$DOMAIN" ]] || { echo "ERROR: --domain is required" >&2; exit 2; }
if [[ $TLS -eq 1 && $CHECK -eq 0 && -z "$EMAIL" ]]; then echo "ERROR: --email is required for certbot (or pass --no-tls)" >&2; exit 2; fi
[[ $(id -u) -eq 0 ]] || { echo "ERROR: run as root (sudo)" >&2; exit 2; }

ok()   { printf '  ok    %s\n' "$*"; }
todo() { printf '  TODO  %s\n' "$*"; }
run()  { if [[ $CHECK -eq 1 ]]; then todo "$*"; else echo "  +     $*"; "$@"; fi; }
FAILS=0

echo "== host"
. /etc/os-release
case "${VERSION_ID:-}" in 22.04|24.04) ok "Ubuntu $VERSION_ID" ;; *) echo "  WARN  untested OS: ${PRETTY_NAME:-?} (script targets Ubuntu 22.04/24.04)" ;; esac
cpu=$(nproc); mem=$(awk '/MemTotal/{printf "%d", $2/1024/1024}' /proc/meminfo); disk=$(df -BG / | awk 'NR==2{gsub("G","",$4); print $4}')
echo "  info  ${cpu} vCPU · ${mem}GB RAM · ${disk}GB free on /"
[[ $cpu -ge 4 ]] || { echo "  WARN  < 4 vCPU (Basic guide §3 minimum)"; }
[[ $mem -ge 7 ]] || { echo "  WARN  < 8GB RAM — pass --swap 4G or builds may OOM"; }
[[ $disk -ge 50 ]] || { echo "  WARN  < 50GB free — attachments accumulate here"; }

echo "== dns"
ip4=$(curl -fsS -4 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')
resolved=$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk '{print $1}' | sort -u | head -3 | tr '\n' ' ')
if [[ -n "$resolved" && " $resolved " == *" $ip4 "* ]]; then ok "$DOMAIN → $ip4"; else echo "  WARN  $DOMAIN resolves to '${resolved:-nothing}', this host is $ip4 — certbot will fail until the A record points here"; FAILS=$((FAILS+1)); fi

echo "== time"
if timedatectl show -p Timezone --value 2>/dev/null | grep -qx UTC; then ok "timezone UTC"; else run timedatectl set-timezone UTC; fi

echo "== packages"
export DEBIAN_FRONTEND=noninteractive
need=(); for p in ca-certificates curl gnupg git ufw chrony unattended-upgrades nginx; do dpkg -s "$p" >/dev/null 2>&1 || need+=("$p"); done
if [[ ${#need[@]} -eq 0 ]]; then ok "base packages"; else run apt-get update -qq; run apt-get install -y -qq "${need[@]}"; fi

echo "== docker"
if command -v docker >/dev/null && docker compose version >/dev/null 2>&1; then ok "$(docker --version | cut -d, -f1) · $(docker compose version | cut -d' ' -f4)"; else
  if [[ $CHECK -eq 1 ]]; then todo "install Docker Engine + Compose v2 (docker.com apt repo)"; else
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL "https://download.docker.com/linux/ubuntu/gpg" | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" > /etc/apt/sources.list.d/docker.list
    apt-get update -qq && apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl enable --now docker
  fi
fi

echo "== deploy user"
if id "$DEPLOY_USER" >/dev/null 2>&1; then ok "user $DEPLOY_USER"; else run useradd -m -s /bin/bash "$DEPLOY_USER"; fi
if id -nG "$DEPLOY_USER" 2>/dev/null | grep -qw docker; then ok "$DEPLOY_USER in docker group"; else run usermod -aG docker "$DEPLOY_USER"; fi
home=$(getent passwd "$DEPLOY_USER" | cut -d: -f6 || echo "/home/$DEPLOY_USER")
[[ -d "$home/.ssh" ]] && ok "$home/.ssh present" || todo "copy the operator's public key to $home/.ssh/authorized_keys (chmod 700/600, owner $DEPLOY_USER)"

echo "== swap"
if [[ -n "$SWAP" ]]; then
  if swapon --show | grep -q '/swapfile'; then ok "swapfile active"; else
    run fallocate -l "$SWAP" /swapfile; run chmod 600 /swapfile; run mkswap /swapfile; run swapon /swapfile
    [[ $CHECK -eq 1 ]] || grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  fi
fi

echo "== firewall"
if ufw status 2>/dev/null | grep -q "Status: active"; then ok "ufw active"; else
  if [[ -n "$SSH_ALLOW" ]]; then run ufw allow from "$SSH_ALLOW" to any port 22 proto tcp; else run ufw allow 22/tcp; fi
  run ufw allow 80/tcp; run ufw allow 443/tcp; run ufw default deny incoming; run ufw default allow outgoing
  [[ $CHECK -eq 1 ]] || ufw --force enable
fi

echo "== unattended upgrades"
if grep -qs 'Unattended-Upgrade "1"' /etc/apt/apt.conf.d/20auto-upgrades; then ok "enabled"; else
  [[ $CHECK -eq 1 ]] && todo "enable unattended-upgrades" || printf 'APT::Periodic::Update-Package-Lists "1";\nAPT::Periodic::Unattended-Upgrade "1";\n' > /etc/apt/apt.conf.d/20auto-upgrades
fi

echo "== nginx vhost"
VHOST="/etc/nginx/sites-available/$DOMAIN"
if [[ -f "$VHOST" ]]; then ok "vhost exists ($VHOST)"; else
  if [[ $CHECK -eq 1 ]]; then todo "write $VHOST → 127.0.0.1:$HTTP_PORT and enable"; else
    cat > "$VHOST" <<EOF
# SharpTalk edge (TLS terminates here; certbot appends the ssl block). provision-host.sh
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:$HTTP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
EOF
    ln -sf "$VHOST" "/etc/nginx/sites-enabled/$DOMAIN"
    nginx -t && systemctl reload nginx
  fi
fi

echo "== tls"
if [[ $TLS -eq 0 ]]; then ok "skipped (--no-tls: terminate TLS elsewhere)"; elif [[ -d "/etc/letsencrypt/live/$DOMAIN" ]]; then ok "certificate present ($(openssl x509 -enddate -noout -in /etc/letsencrypt/live/$DOMAIN/cert.pem 2>/dev/null | cut -d= -f2))"; else
  if [[ $CHECK -eq 1 ]]; then todo "certbot --nginx -d $DOMAIN (after DNS points here)"; else
    dpkg -s certbot python3-certbot-nginx >/dev/null 2>&1 || apt-get install -y -qq certbot python3-certbot-nginx
    # No --redirect: on a shared host certbot's redirect edit can touch sibling vhosts
    # (staging lesson). Force HTTPS in the vhost yourself once the cert is issued.
    certbot --nginx -d "$DOMAIN" -m "$EMAIL" --agree-tos --non-interactive --no-redirect
    systemctl reload nginx
  fi
fi

echo "== summary"
if [[ $CHECK -eq 1 ]]; then echo "  check mode: nothing changed. Re-run without --check to apply."; fi
[[ $FAILS -eq 0 ]] || echo "  WARN  $FAILS item(s) need attention before TLS/deploy (see above)."
cat <<EOF
  next (as $DEPLOY_USER):
    git clone https://github.com/KimIgyong/btbz-sharp-talk.git ~/sharptalk && cd ~/sharptalk
    cp deploy/profiles/<alias>/.env.<alias>.example docker/self-hosted/.env.self-hosted   # fill secrets (scripts/gen-secrets.sh)
    bash scripts/deploy-self-hosted.sh --check && bash scripts/deploy-self-hosted.sh
EOF
