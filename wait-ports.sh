#!/bin/sh
# wait-ports.sh <free|up> [n] — block until the ports are all free, or until
# exactly n of them are listening.
want="$1"
need="${2:-6}"
for _ in $(seq 1 60); do
  n=0
  for p in 8821 8822 8831 8832 8833 8841; do
    if lsof -ti "tcp:$p" >/dev/null 2>&1; then n=$((n + 1)); fi
  done
  case "$want" in
    free) [ "$n" -eq 0 ] && exit 0 ;;
    up)   [ "$n" -eq "$need" ] && exit 0 ;;
  esac
  sleep 0.2
done
echo "wait-ports: gave up waiting for ports to be $want (saw $n)" >&2
exit 1
