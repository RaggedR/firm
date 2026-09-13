#!/bin/sh
if [ -f /tmp/firm.pids ]; then
  while read -r pid; do kill "$pid" 2>/dev/null || true; done < /tmp/firm.pids
  rm -f /tmp/firm.pids
fi
for p in 8821 8822 8831 8832 8833 8841; do
  pid=$(lsof -ti "tcp:$p" 2>/dev/null || true)
  [ -n "$pid" ] && kill $pid 2>/dev/null || true
done
exit 0
