#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"
npm run build
# This app's canonical origin is app.wallyatkins.com. Never upload it over
# wallyatkins.com/app/, which is the public installation information page.
rsync -az --exclude=.git --exclude=node_modules --exclude=dist --exclude='.env*' \
  --exclude='*.sqlite*' --exclude='*.tsbuildinfo' ./ oci-arm:/home/ubuntu/wally-pwa-source/
ssh oci-arm 'sudo docker compose --env-file /opt/wally-assistant/runtime-image.env -p wally-assistant -f /home/ubuntu/wally-pwa-source/deploy/compose.yml build pwa && sudo docker compose --env-file /opt/wally-assistant/runtime-image.env -p wally-assistant -f /home/ubuntu/wally-pwa-source/deploy/compose.yml up -d --no-deps pwa'
