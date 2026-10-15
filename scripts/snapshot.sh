#!/usr/bin/env bash
# Snapshot market data for every privacy category into data/cat_<category>_p1.json
# Usage:  bash scripts/snapshot.sh [--sleep 6]
set -uo pipefail

SLEEP=${SLEEP:-6}
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CATS="$ROOT/data/categories.txt"
[ -f "$CATS" ] || { echo "missing $CATS" >&2; exit 1; }

mkdir -p "$ROOT/data"
fail=0
while read -r cat; do
  [ -z "$cat" ] && continue
  out="$ROOT/data/cat_${cat}_p1.json"
  echo "==> $cat"
  code=$(curl -s --retry 5 --retry-delay 10 -m 40 -w '%{http_code}' \
    "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&category=${cat}&order=market_cap_desc&per_page=250&page=1&price_change_percentage=24h,7d,30d,1y" \
    -o "$out")
  size=$(wc -c < "$out" 2>/dev/null || echo 0)
  if [ "$code" != "200" ] || [ "$size" -lt 3 ]; then
    echo "    FAILED http=$code size=$size" >&2
    fail=1
  else
    echo "    ok http=$code size=$size"
  fi
  sleep "$SLEEP"   # free tier rate limit guard
done < "$CATS"

if [ "$fail" != "0" ]; then
  echo "snapshot finished with failures — re-run before building" >&2
  exit 1
fi
echo "snapshot complete: $(ls "$ROOT"/data/cat_*_p1.json | wc -l) file(s)"
