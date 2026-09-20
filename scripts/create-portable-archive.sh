#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="${1:-/home/ubuntu/exports}"
ARCHIVE_NAME="FINTEL-Kenya-Financial-Intelligence-checkpoint-2026-09-20.zip"
mkdir -p "$OUTPUT_DIR"
rm -f "$OUTPUT_DIR/$ARCHIVE_NAME"

cd "$PROJECT_DIR"
zip -r "$OUTPUT_DIR/$ARCHIVE_NAME" . \
  -x './node_modules/*' \
  -x './dist/*' \
  -x './build/*' \
  -x './.git/*' \
  -x './.manus-logs/*' \
  -x './.project-config.json' \
  -x './client/public/__manus__/debug-collector.js' \
  -x './client/public/__manus__/version.json' \
  -x './*.log' \
  -x './.env' \
  -x './.env.*' \
  -x './backups/*-data.sql' \
  -x './backups/*-dump.sql' \
  -x './tmp/*' \
  -x './temp/*' \
  >/tmp/fintel-zip.log

printf '%s\n' "$OUTPUT_DIR/$ARCHIVE_NAME"
