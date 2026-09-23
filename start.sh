#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
if ! command -v node >/dev/null 2>&1; then
  if [ -x /home/lavcca/.local/lib/node-racing/bin/node ]; then
    export PATH="/home/lavcca/.local/lib/node-racing/bin:$PATH"
  else
    echo 'Node.js 22 이상을 설치한 후 npm ci를 실행해 주세요.' >&2
    exit 1
  fi
fi
exec npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
