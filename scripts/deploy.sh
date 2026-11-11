#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "==> Building Wally Atkins PWA..."
cd "$PROJECT_ROOT"
npm run build

echo "==> Creating .htaccess for /app/ SPA fallback..."
cat << 'EOF' > "$PROJECT_ROOT/dist/.htaccess"
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /app/
  RewriteCond %{REQUEST_FILENAME} -f [OR]
  RewriteCond %{REQUEST_FILENAME} -d
  RewriteRule ^ - [L]
  RewriteRule ^ index.html [L]
</IfModule>
EOF

echo "==> Deploying to Bluehost (wallyatkins.com/app/)..."
ssh multili2@wallyatkins.com "mkdir -p /home4/multili2/public_html/wallyatkins/app"
rsync -avz --delete "$PROJECT_ROOT/dist/" multili2@wallyatkins.com:/home4/multili2/public_html/wallyatkins/app/

echo "==> Uploading updated football_api.php..."
rsync -avz "$PROJECT_ROOT/../website/football_api.php" multili2@wallyatkins.com:/home4/multili2/public_html/wallyatkins/football_api.php

echo "==> Deployment complete! Accessible at: https://wallyatkins.com/app/"
