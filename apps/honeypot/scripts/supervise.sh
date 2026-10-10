#!/bin/sh
# Runs the honeypot as two Beelzebub processes:
#   core  — the fixed services in config/services/, never restarted
#   annex — the lures the city planner opens at runtime, written by the API into $ANNEX_DIR
# Beelzebub does not reload its services, so the annex is restarted whenever that directory changes. Once it is up,
# the list of lures it loaded is written to $ANNEX_MANIFEST: the API only calls a lure open once it appears there.
set -u
BEELZEBUB=${BEELZEBUB:-beelzebub}
ANNEX_DIR=${ANNEX_DIR:-config/annex}
ANNEX_MANIFEST=${ANNEX_MANIFEST:-../../logs/annex.txt}

mkdir -p "$ANNEX_DIR" "$(dirname "$ANNEX_MANIFEST")"
publish() { printf '%s' "$1" > "$ANNEX_MANIFEST.tmp" && mv "$ANNEX_MANIFEST.tmp" "$ANNEX_MANIFEST"; }
lures() { (cd "$ANNEX_DIR" && ls -- *.yaml 2>/dev/null); }

"$BEELZEBUB" run -c config/beelzebub.yaml -s config/services/ &
core=$!
annex=""
last=""
publish ""

stop_annex() {
  [ -n "$annex" ] && kill "$annex" 2>/dev/null && wait "$annex" 2>/dev/null
  annex=""
}
trap 'stop_annex; kill "$core" 2>/dev/null; wait "$core" 2>/dev/null; publish ""; exit 0' INT TERM

while kill -0 "$core" 2>/dev/null; do
  sum=$(cat "$ANNEX_DIR"/*.yaml 2>/dev/null | cksum)
  if [ "$sum" != "$last" ]; then
    last=$sum
    publish ""
    stop_annex
    if [ -n "$(lures)" ]; then
      "$BEELZEBUB" run -c config/annex.yaml -s "$ANNEX_DIR/" &
      annex=$!
      sleep 2
      if kill -0 "$annex" 2>/dev/null; then
        publish "$(lures)"
        echo "[annex] serving: $(lures | tr '\n' ' ')"
      else
        annex=""
        echo "[annex] failed to start; waiting for the lures to change" >&2
      fi
    fi
  elif [ -n "$annex" ] && ! kill -0 "$annex" 2>/dev/null; then
    # It died on its own: take the lures off the manifest, and retry once they change.
    annex=""
    publish ""
    echo "[annex] exited" >&2
  fi
  sleep 3
done
echo "[core] exited" >&2
stop_annex
publish ""
exit 1
