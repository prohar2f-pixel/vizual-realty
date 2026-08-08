#!/usr/bin/env bash
# Ежедневная резервная копия PostgreSQL для production.
# Запускается из cron на сервере; секреты читаются только из защищённого .env.
set -euo pipefail

APP_DIR="${APP_DIR:-/home/vizual/app}"
ENV_FILE="${ENV_FILE:-${APP_DIR}/.env}"
BACKUP_ROOT="${BACKUP_ROOT:-/home/vizual/backups/automatic}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
PG_DUMP_BIN="${PG_DUMP_BIN:-/usr/bin/pg_dump}"

if [[ "$BACKUP_ROOT" != "/home/vizual/backups/automatic" ]]; then
  echo "backup error: unexpected backup directory" >&2
  exit 1
fi

if [[ ! -r "$ENV_FILE" ]]; then
  echo "backup error: environment file is not readable" >&2
  exit 1
fi

if [[ ! -x "$PG_DUMP_BIN" ]]; then
  echo "backup error: pg_dump is not executable" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "backup error: DATABASE_URL is not set" >&2
  exit 1
fi

umask 077
mkdir -p "$BACKUP_ROOT"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
temporary_directory="$(mktemp -d "${BACKUP_ROOT}/.incomplete-${timestamp}.XXXXXX")"
final_directory="${BACKUP_ROOT}/${timestamp}"

cleanup() {
  rm -rf "$temporary_directory"
}
trap cleanup EXIT

"$PG_DUMP_BIN" --format=custom --file="$temporary_directory/database.dump" "$DATABASE_URL"

if [[ ! -s "$temporary_directory/database.dump" ]]; then
  echo "backup error: pg_dump created an empty file" >&2
  exit 1
fi

(
  cd "$temporary_directory"
  sha256sum database.dump > database.dump.sha256
)
mv "$temporary_directory" "$final_directory"
trap - EXIT

# Удаляем только завершённые автоматические копии старше срока хранения.
find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -name '20*' -mtime "+${RETENTION_DAYS}" -exec rm -rf {} +

echo "backup complete: ${final_directory}/database.dump"
