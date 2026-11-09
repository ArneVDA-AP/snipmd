#!/usr/bin/env bash
# Usage: bash run.sh <ID> [session]. Builds <ID>.js, runs it in the playwright-cli session, writes <ID>.json.
set -u
cd "$(dirname "$0")"
id="$1"; sess="${2:-snip-rc}"
python build.py "$id" >/dev/null
start=$(date +%s%3N)
playwright-cli -s="$sess" --raw run-code --filename="$id.js" > "$id.raw" 2>&1
code=$?
end=$(date +%s%3N)
python -c "import json,sys; d=json.load(open(sys.argv[1],encoding='utf-8')); d=json.loads(d) if isinstance(d,str) else d; json.dump(d,open(sys.argv[2],'w',encoding='utf-8'))" "$id.raw" "$id.json" && rm "$id.raw"
echo "run-code exit=$code wall_ms=$((end-start))"
ls -la "$id.json" "$id.raw" 2>/dev/null
