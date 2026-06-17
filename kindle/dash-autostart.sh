#!/bin/sh
# Starts the dashboard loop after the Kindle framework and Wi-Fi are ready.
# This file stays on /mnt/us; the Upstart job only delegates to it.

LOOP=/mnt/us/dash-loop.sh
PIDFILE=/mnt/us/dash-loop.pid
LOG=/mnt/us/dash-autostart.log
LOOP_LOG=/mnt/us/dash-loop.log
ENV_FILE=/mnt/us/dash-autostart.env
DISABLED=/mnt/us/dash-autostart.disabled

log() {
  echo "[dash-autostart] $(date) $*" >> "$LOG"
}

if [ -f "$DISABLED" ]; then
  log "disabled; not starting"
  exit 0
fi

if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  . "$ENV_FILE"
fi

PC="${PC:-}"
INTERVAL="${INTERVAL:-45}"
FULL_EVERY="${FULL_EVERY:-20}"
WIFI_RETRY_EVERY="${WIFI_RETRY_EVERY:-3}"
export PC INTERVAL FULL_EVERY WIFI_RETRY_EVERY

if [ -z "$PC" ]; then
  log "missing PC dashboard URL"
  exit 2
fi

remaining=60
while [ ! -f "$LOOP" ] && [ "$remaining" -gt 0 ]; do
  sleep 2
  remaining=$((remaining - 2))
done

if [ ! -f "$LOOP" ]; then
  log "missing $LOOP after waiting 60s"
  exit 1
fi

remaining=90
while [ "$remaining" -gt 0 ]; do
  STATE=$(lipc-get-prop com.lab126.wifid cmState 2>/dev/null)
  [ "$STATE" = "CONNECTED" ] && break
  sleep 3
  remaining=$((remaining - 3))
done

rm -f /mnt/us/dash-loop.stop
log "starting loop (wifi=${STATE:-unknown}, PC=$PC)"
setsid sh "$LOOP" </dev/null >> "$LOOP_LOG" 2>&1 &
sleep 2

PID=$(cat "$PIDFILE" 2>/dev/null)
if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
  log "loop running pid=$PID"
  exit 0
fi

log "loop failed to start"
exit 1
