#!/bin/bash
# set -euxo pipefail
set -euo pipefail
cd `/usr/bin/dirname $0`

trap "final; exit 1" 2

function final {
  echo "Ctrl+C pushed."
}

dir=$(greadlink -f .)

while true; do
  set +e
  npm run build
  set -e

  out=$(fswatch \
    --one-event \
    --recursive \
    --exclude='.*' \
    --include=$dir'/src/.*\.ts$' \
    --include=$dir'/src/.*\.css$' \
    --include=$dir'/src/.*\.svg$' \
    .)

  if [ -z "$out" ]; then
    break  
  fi
done
