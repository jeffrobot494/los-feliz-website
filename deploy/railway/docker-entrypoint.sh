#!/bin/bash
# Starts the LFAR preview: listens on Railway's port, loads the bundled database
# snapshot when it is new, points the site at its Railway address, then runs Apache.
set -euo pipefail

PORT="${PORT:-8080}"
sed -ri "s/^Listen .*/Listen ${PORT}/" /etc/apache2/ports.conf
sed -ri "s/<VirtualHost \*:[0-9]+>/<VirtualHost *:${PORT}>/" /etc/apache2/sites-available/000-default.conf

if [ -z "${RAILWAY_PUBLIC_DOMAIN:-}" ]; then
  echo "[lfar] RAILWAY_PUBLIC_DOMAIN is not set. Generate a domain for this service in Railway (Settings > Networking), then redeploy." >&2
  exit 1
fi
SITE_URL="https://${RAILWAY_PUBLIC_DOMAIN}"
WP="wp --allow-root --path=/var/www/html --skip-plugins --skip-themes"
DUMP=/usr/local/lib/lfar/db.sql
HASH="$(sha1sum "$DUMP" | cut -d' ' -f1)"

echo "[lfar] Waiting for MySQL at ${MYSQLHOST:-?}:${MYSQLPORT:-?} ..."
php /usr/local/lib/lfar/import-db.php wait

CURRENT="$($WP option get lfar_preview_dump_hash 2>/dev/null || true)"
if [ "$CURRENT" != "$HASH" ]; then
  echo "[lfar] Loading database snapshot ${HASH:0:10} ..."
  php /usr/local/lib/lfar/import-db.php import "$DUMP"
  $WP search-replace 'http://los-feliz-animal-rescue.local' "$SITE_URL" --all-tables --precise --report-changed-only
  $WP search-replace 'los-feliz-animal-rescue.local' "$RAILWAY_PUBLIC_DOMAIN" --all-tables --precise --report-changed-only
  # Preview only: keep search engines out
  $WP option update blog_public 0
  $WP option update lfar_preview_dump_hash "$HASH"
  echo "[lfar] Database ready at $SITE_URL"
else
  echo "[lfar] Database snapshot unchanged; keeping existing data."
fi

# Domain changed since the last import (e.g. a new Railway domain)
OLD_HOME="$($WP eval 'global $wpdb; echo $wpdb->get_var("SELECT option_value FROM {$wpdb->options} WHERE option_name = '"'"'home'"'"'");' 2>/dev/null || true)"
if [ -n "$OLD_HOME" ] && [ "$OLD_HOME" != "$SITE_URL" ]; then
  echo "[lfar] Moving site from $OLD_HOME to $SITE_URL"
  $WP search-replace "$OLD_HOME" "$SITE_URL" --all-tables --precise --report-changed-only
fi

chown -R www-data:www-data /var/www/html/wp-content/uploads
exec "$@"
