#!/bin/sh
# up.sh — five processes: research, development, and three sales agents.
#
# Permissions are scoped per server. Deno denies by default, so each grant is a
# claim about the topology — but only ONE of the two kinds of claim is actually
# enforced, and ./sandbox-check.sh demonstrates both results.
#
# ENFORCED — leaf-ness, by withholding --allow-run:
#
#   research  no --allow-run at all. A hop is a process, so a server that
#             cannot spawn cannot originate an edge. This holds even if someone
#             edits research.server.ts to delegate: see rogue.server.ts.
#
# NOT ENFORCED — which edges a non-leaf may take. The --allow-net lists below
# are documentation of intent, not a mechanism, because lib/wire.ts spawns the
# hop with an unscoped --allow-net and the child inherits nothing from us. Any
# server with --allow-run=deno can reach any host through that child.
#
#   dev       intends to reach 8821 only
#   sales     intends to reach 8822 only
#   ceo       intends to reach 8831..8833 only — it commands the shape of the
#             firm and is meant to have no route into its books
#
# The one-line upstream fix is in sandbox-check.sh. lib/ is vendored verbatim
# and is not edited here.
set -e
cd "$(dirname "$0")"

./down.sh >/dev/null 2>&1 || true
./wait-ports.sh free

export FIRM_SEED="${FIRM_SEED:-1928}"
export FIRM_RESEARCH_CAPACITY="${FIRM_RESEARCH_CAPACITY:-6}"
export FIRM_DEV_CAPACITY="${FIRM_DEV_CAPACITY:-8}"
export FIRM_SALES_CAPACITY="${FIRM_SALES_CAPACITY:-5}"

: > /tmp/firm.pids

# A leaf: it serves, and it may do nothing else.
deno run --quiet --allow-net=0.0.0.0:8821 --allow-env \
  research.server.ts > /tmp/firm-research.log 2>&1 &
echo "$!" >> /tmp/firm.pids

# The worker. It serves on 8822 and may reach 8821. --allow-run is scoped to
# deno because a hop is a process: delegate.ts is spawned, not called.
deno run --quiet \
  --allow-net=0.0.0.0:8822,127.0.0.1:8821,localhost:8821 \
  --allow-run=deno --allow-read=. --allow-env \
  dev.server.ts > /tmp/firm-dev.log 2>&1 &
echo "$!" >> /tmp/firm.pids

i=0
for port in 8831 8832 8833; do
  FIRM_SALES_PORT="$port" FIRM_SALES_NAME="sales$i" \
  deno run --quiet \
    --allow-net=0.0.0.0:"$port",127.0.0.1:8822,localhost:8822 \
    --allow-run=deno --allow-read=. --allow-env \
    sales.server.ts > "/tmp/firm-sales$i.log" 2>&1 &
  echo "$!" >> /tmp/firm.pids
  i=$((i + 1))
done

# The orchestrating agent. Its board is durable because it is a process.
deno run --quiet \
  --allow-net=0.0.0.0:8841,127.0.0.1:8831,127.0.0.1:8832,127.0.0.1:8833,localhost:8831,localhost:8832,localhost:8833 \
  --allow-run=deno --allow-read=. --allow-env \
  ceo.server.ts > /tmp/firm-ceo.log 2>&1 &
echo "$!" >> /tmp/firm.pids

./wait-ports.sh up 6
echo "up: research :8821  dev :8822  sales0 :8831  sales1 :8832  sales2 :8833  ceo :8841"
echo "    seed $FIRM_SEED — research is the only source of variation"
