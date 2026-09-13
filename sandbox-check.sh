#!/bin/sh
# sandbox-check.sh — does the permission set actually enforce the topology?
#
# Starts rogue.server.ts, which is research with one extra line that phones a
# sales agent, under RESEARCH's exact permission set, and prompts it. If the
# sandbox is real the added edge cannot be taken.
set -e
cd "$(dirname "$0")"

echo "starting rogue.server.ts on :8829 with research's permissions"
echo "  --allow-net=0.0.0.0:8829 --allow-env     (no --allow-run, no outbound net)"
echo ""

deno run --quiet --allow-net=0.0.0.0:8829 --allow-env \
  rogue.server.ts > /tmp/firm-rogue.log 2>&1 &
rogue=$!
trap 'kill $rogue 2>/dev/null || true' EXIT

for _ in $(seq 1 40); do
  lsof -ti tcp:8829 >/dev/null 2>&1 && break
  sleep 0.2
done

echo "prompting it:  {\"tag\":\"Investigate\",\"briefs\":3,\"year\":1928}"
echo ""
code=$(curl -s -o /tmp/firm-rogue-reply.json -w '%{http_code}' \
  -X POST -H 'content-type: application/json' \
  -d '{"tag":"Investigate","briefs":3,"year":1928}' http://localhost:8829 || echo 000)

echo "HTTP $code"
echo "reply: $(cat /tmp/firm-rogue-reply.json 2>/dev/null)"
echo ""
if [ "$code" = "500" ] && grep -qi 'not.*capab\|permission\|denied\|requires' /tmp/firm-rogue-reply.json; then
  echo "PASS — a server with no --allow-run cannot delegate. Leaf-ness is enforced."
else
  echo "FAIL — the rogue edge was taken. The sandbox is not doing what up.sh claims."
  exit 1
fi

kill $rogue 2>/dev/null || true
for _ in $(seq 1 40); do lsof -ti tcp:8829 >/dev/null 2>&1 || break; sleep 0.2; done

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "CASE 2 — the same rogue, now WITH --allow-run=deno, and net scoped"
echo "         to its own port only. 8831 is not in its allow-net list."
echo ""

deno run --quiet --allow-net=0.0.0.0:8829 --allow-run=deno --allow-read=. --allow-env \
  rogue.server.ts > /tmp/firm-rogue2.log 2>&1 &
rogue=$!
for _ in $(seq 1 40); do lsof -ti tcp:8829 >/dev/null 2>&1 && break; sleep 0.2; done

reply=$(curl -s -X POST -H 'content-type: application/json' \
  -d '{"tag":"Investigate","briefs":3,"year":1928}' http://localhost:8829 || echo '')
echo "reply: $reply"
echo ""

case "$reply" in
  *ideas*)
    cat <<'NOTE'
KNOWN GAP — the edge was taken, and the parent's --allow-net did not stop it.

lib/wire.ts spawns the hop with an UNSCOPED grant:

    args: ["run", "--quiet", "--allow-net", "--allow-env", script, ...]

so any server holding --allow-run=deno reaches any host through the child.
Scoping a non-leaf's outbound net is therefore decorative: it constrains the
server's own fetches and not its delegations.

What IS enforced is leaf-ness (case 1), which is the stronger half: a server
with no --allow-run cannot originate an edge at all.

The fix is one line upstream, in lib/wire.ts, and the information is already
there because delegate.ts is handed the port:

    "--allow-net=127.0.0.1:" + port + ",localhost:" + port

lib/ is vendored verbatim and is not edited here; lib/README.md records that a
change would be the beginning of a fork. So this is reported, not patched.
NOTE
    ;;
  *)
    echo "The gap appears to be closed — lib/wire.ts may have been fixed upstream."
    echo "If so, up.sh's per-edge claims are now true and this note should go."
    ;;
esac
