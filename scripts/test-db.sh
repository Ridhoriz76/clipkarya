#!/usr/bin/env bash
# Applies the migrations to a throwaway database on a vanilla PostgreSQL and runs
# the RLS/credits/timeline test. Usage: PGURL=postgres://postgres@localhost:5432/postgres scripts/test-db.sh
set -euo pipefail
cd "$(dirname "$0")/.."
PGURL=${PGURL:-postgres://postgres@localhost:5432/postgres}
DB=clipkarya_test_$$
psql "$PGURL" -qc "create database $DB"
trap 'psql "$PGURL" -qc "drop database if exists $DB" >/dev/null' EXIT
URL="${PGURL%/*}/$DB"
psql "$URL" -q -v ON_ERROR_STOP=1 -f supabase/tests/stub_supabase.sql
for f in supabase/migrations/*.sql; do psql "$URL" -q -v ON_ERROR_STOP=1 -f "$f"; done
psql "$URL" -q -v ON_ERROR_STOP=1 -f supabase/seed.sql
psql "$URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_test.sql
