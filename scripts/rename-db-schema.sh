#!/usr/bin/env bash
# Move every table of one MySQL schema into another (metadata-only RENAME TABLE),
# create the new app user and grant it. Used for REQ-260909 C (db_ivy_talktalk →
# db_sharptalk); generic for self-hosted installs that want the new name.
#
#   MYSQL_CONTAINER=sharptalk_mysql_staging OLD_DB=db_ivy_talktalk NEW_DB=db_sharptalk \
#   NEW_USER=sharptalk NEW_PASSWORD='…' bash scripts/rename-db-schema.sh
#
# Preconditions (verified on staging 2026-09-09): no views/triggers/routines/FKs in
# OLD_DB — RENAME TABLE across schemas does not carry those. Stop the API first.
# Reversible: swap OLD_DB/NEW_DB and run again. Requires $MYSQL_ROOT_PASSWORD in the
# container env (the official image sets it).
set -euo pipefail
: "${MYSQL_CONTAINER:?}" "${OLD_DB:?}" "${NEW_DB:?}" "${NEW_USER:?}" "${NEW_PASSWORD:?}"
q() { docker exec -i "$MYSQL_CONTAINER" sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N' 2>/dev/null; }
objs=$(printf "SELECT (SELECT COUNT(*) FROM information_schema.views WHERE table_schema='%s')+(SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema='%s')+(SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema='%s')+(SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema='%s');" "$OLD_DB" "$OLD_DB" "$OLD_DB" "$OLD_DB" | q)
[ "$objs" = "0" ] || { echo "ABORT: $OLD_DB has $objs views/triggers/routines/FKs — RENAME TABLE cannot carry them" >&2; exit 1; }
printf "CREATE DATABASE IF NOT EXISTS \`%s\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" "$NEW_DB" | q
tables=$(printf "SELECT table_name FROM information_schema.tables WHERE table_schema='%s' AND table_type='BASE TABLE' ORDER BY table_name;" "$OLD_DB" | q)
n=0
for t in $tables; do printf "RENAME TABLE \`%s\`.\`%s\` TO \`%s\`.\`%s\`;" "$OLD_DB" "$t" "$NEW_DB" "$t" | q; n=$((n+1)); done
printf "CREATE USER IF NOT EXISTS '%s'@'%%' IDENTIFIED BY '%s'; GRANT ALL PRIVILEGES ON \`%s\`.* TO '%s'@'%%'; FLUSH PRIVILEGES;" "$NEW_USER" "$NEW_PASSWORD" "$NEW_DB" "$NEW_USER" | q
left=$(printf "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='%s';" "$OLD_DB" | q)
moved=$(printf "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='%s';" "$NEW_DB" | q)
echo "moved $n tables: $OLD_DB now $left, $NEW_DB now $moved. Old schema left in place — drop it after verification."
