#!/bin/sh
# Starts the shop. Hosts like Railway mount volumes owned by root, so as root we first prepare the
# data folder, then continue as the unprivileged "node" user.
set -e
DATA_DIR="$(dirname "${DATABASE_PATH:-/data/shop.db}")"
if [ "$(id -u)" = "0" ]; then
  mkdir -p "$DATA_DIR"
  chown -R node:node "$DATA_DIR"
fi
if ! mountpoint -q "$DATA_DIR"; then
  echo "[shop] LET OP: $DATA_DIR is geen gekoppeld volume. Bestellingen, foto's en instellingen gaan verloren bij de volgende deploy." >&2
fi
if [ "$(id -u)" = "0" ]; then
  exec setpriv --reuid=node --regid=node --init-groups node_modules/.bin/tsx server/index.ts
fi
exec node_modules/.bin/tsx server/index.ts
