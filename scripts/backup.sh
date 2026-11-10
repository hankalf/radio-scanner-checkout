#!/usr/bin/env bash
#
# Back up the Safety Knife Checkout database to a timestamped SQL dump.
#
# Usage:
#   ./scripts/backup.sh                 # writes to ./backups/
#   BACKUP_DIR=/mnt/nas ./scripts/backup.sh
#
# Requires: pg_dump (PostgreSQL client tools) and a DATABASE_URL in the
# environment (or a .env file next to this repo). The audit log is the
# compliance backbone — schedule this (see README "Database backups").
set -euo pipefail

# Load DATABASE_URL from .env if it isn't already set.
if [ -z "${DATABASE_URL:-}" ] && [ -f "$(dirname "$0")/../.env" ]; then
  # shellcheck disable=SC1090
  set -a; . "$(dirname "$0")/../.env"; set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "error: DATABASE_URL is not set (and no .env found)." >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "error: pg_dump not found — install the PostgreSQL client tools." >&2
  exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-$(dirname "$0")/../backups}"
mkdir -p "$BACKUP_DIR"

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/knife-backup-$STAMP.sql.gz"

# Prisma appends a `?schema=public` query param that pg_dump rejects; strip it.
DUMP_URL="$(printf '%s' "$DATABASE_URL" | sed -E 's/([?&])schema=[^&]*(&|$)/\1/; s/[?&]$//')"

echo "Backing up database → $OUT"
# --no-owner/--no-acl keep the dump portable across hosts; gzip to save space.
pg_dump --no-owner --no-acl "$DUMP_URL" | gzip > "$OUT"
echo "Done: $(du -h "$OUT" | cut -f1) $OUT"

# Optional retention: keep the newest 30 dumps in BACKUP_DIR.
KEEP="${BACKUP_KEEP:-30}"
ls -1t "$BACKUP_DIR"/knife-backup-*.sql.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
