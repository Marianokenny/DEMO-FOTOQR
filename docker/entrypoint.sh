#!/bin/sh
# Starts the web app ("web") or the worker ("worker").
# - APP_SECRET: if not given, one is created once and kept in the data volume.
# - APP_URL: if not given and the Cloudflare quick tunnel is running, its public https address is used,
#   so the QR codes and links point to the address guests can open.
set -e
DATA_DIR="${DATA_DIR:-/data}"
mkdir -p "$DATA_DIR/storage"

if [ -z "$APP_SECRET" ]; then
  [ -f "$DATA_DIR/app-secret" ] || node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))" > "$DATA_DIR/app-secret"
  APP_SECRET=$(cat "$DATA_DIR/app-secret")
  export APP_SECRET
fi

if [ -z "$APP_URL" ] && [ -n "$TUNNEL_METRICS_URL" ]; then
  echo "Esperando la dirección pública del túnel de Cloudflare..."
  APP_URL=$(node -e '
    const url = process.env.TUNNEL_METRICS_URL + "/quicktunnel";
    (async () => {
      for (let i = 0; i < 90; i++) {
        try {
          const r = await fetch(url);
          const { hostname } = await r.json();
          if (hostname) { console.log("https://" + hostname); return; }
        } catch {}
        await new Promise((r) => setTimeout(r, 2000));
      }
      process.exit(1);
    })();
  ') || { echo "No se pudo obtener la dirección del túnel"; exit 1; }
  export APP_URL
fi
export APP_URL="${APP_URL:-http://localhost:3000}"

case "$1" in
  web)
    npx prisma migrate deploy
    echo ""
    echo "  FOTOSQR listo en: $APP_URL"
    echo ""
    exec npx next start -H 0.0.0.0 -p "${PORT:-3000}"
    ;;
  worker)
    exec npx tsx src/worker/index.ts
    ;;
  *)
    exec "$@"
    ;;
esac
