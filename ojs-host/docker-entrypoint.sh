#!/bin/sh
# OJS Fly entrypoint.
#
# Generates /var/www/html/config.inc.php from the `config.TEMPLATE.inc.php`
# that ships with the image, substituting secrets from the Fly environment.
# We do this at container start (not build time) so the image can be
# rebuilt without baking DB credentials into the layer.

set -e

TEMPLATE="/var/www/html/config.TEMPLATE.inc.php"
TARGET="/var/www/html/config.inc.php"

if [ ! -f "$TARGET" ]; then
    if [ ! -f "$TEMPLATE" ]; then
        echo "[sofai-ojs] ERROR: no config template at $TEMPLATE" >&2
        exit 1
    fi

    # Minimal sed-based substitution. OJS's config.inc.php uses ini syntax —
    # we flip the driver + DB credentials + base URL. Everything else stays
    # at image defaults; operators will tune via the web-wizard.
    cp "$TEMPLATE" "$TARGET"
    sed -i \
        -e "s|^driver = mysqli|driver = postgres|" \
        -e "s|^host = localhost|host = ${OJS_DB_HOST:-localhost}|" \
        -e "s|^username = ojs-ci|username = ${OJS_DB_USER:-ojs}|" \
        -e "s|^password = ojs-ci|password = ${OJS_DB_PASSWORD:-}|" \
        -e "s|^name = ojs-ci|name = ${OJS_DB_NAME:-ojs}|" \
        "$TARGET"

    if [ -n "$OJS_BASE_URL" ]; then
        # OJS's base_url key lives under `[general]`. We rely on sed idempotency
        # so re-running the entrypoint is safe.
        sed -i \
            -e "s|^base_url = \"http://localhost/ojs\"|base_url = \"${OJS_BASE_URL}\"|" \
            "$TARGET"
    fi

    chown www-data:www-data "$TARGET"
    echo "[sofai-ojs] config.inc.php generated from template."
fi

# Ensure Fly volume-backed directories are writable. The base image sets
# these, but mounting a fresh Fly volume wipes permissions.
mkdir -p /var/www/files /var/www/html/public
chown -R www-data:www-data /var/www/files /var/www/html/public || true

exec "$@"
