#!/bin/sh
# ==============================================================================
# Automated Database Backup Script for Real Estate Management System (PostgreSQL)
# ==============================================================================
set -e

BACKUP_DIR="${BACKUP_DIR:-/backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/real_estate_db_${TIMESTAMP}.sql.gz"

echo "[$(date)] Initiating automated database backup..."
mkdir -p "${BACKUP_DIR}"

PGPASSWORD="${POSTGRES_PASSWORD:-postgres123}" pg_dump \
  -h "${POSTGRES_HOST:-localhost}" \
  -U "${POSTGRES_USER:-postgres}" \
  -d "${POSTGRES_DB:-real_estate_db}" \
  --clean --if-exists --no-owner --no-privileges | gzip > "${BACKUP_FILE}"

echo "[$(date)] Backup completed successfully: ${BACKUP_FILE}"

# Retention Policy: Delete backups older than 30 days
find "${BACKUP_DIR}" -type f -name "real_estate_db_*.sql.gz" -mtime +30 -delete
echo "[$(date)] Retention policy applied. Backups older than 30 days purged."

