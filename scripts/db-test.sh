#!/usr/bin/env bash
# Applies the migrations to a scratch Postgres database and runs supabase/tests/integration.sql.
# Uses the standard PGHOST / PGPORT / PGUSER / PGPASSWORD variables. The user needs CREATEDB and CREATEROLE.
set -euo pipefail
NAME="devmint_test_$$"
psql -d postgres -q -c "create database $NAME"
trap 'psql -d postgres -q -c "drop database if exists $NAME" >/dev/null' EXIT
cd "$(dirname "$0")/.."
run() { psql -d "$NAME" -q -v ON_ERROR_STOP=1 -f "$1" 2> >(grep -v -E "WARNING|HINT" >&2); }
run supabase/tests/supabase_stub.sql
for f in supabase/migrations/*.sql; do run "$f"; done
psql -d "$NAME" -q -t -v ON_ERROR_STOP=1 -f supabase/tests/integration.sql
