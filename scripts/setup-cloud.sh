#!/usr/bin/env bash
# One-time (and safe to re-run) setup of Jugnu's online part in the shared Supabase project:
#   1. creates the jugnu_* tables and functions (supabase/migrations/0001_jugnu_accounts.sql)
#   2. marks the admin email(s)
#   3. deploys the jugnu-ai Edge Function (Claude, then Gemini; keys are the project's existing secrets)
# Nothing of Ginti's is changed. Usage: bash scripts/setup-cloud.sh admin@example.com [more@example.com]
set -euo pipefail
cd "$(dirname "$0")/.."
REF="${JUGNU_SUPABASE_REF:-oeqglnatffufrexhbfry}"
SB="npx -y supabase@latest"

[ $# -ge 1 ] || { echo "Give at least one admin email."; exit 1; }

echo "1/3 Tables and functions…"
$SB db query --remote="$REF" --yes -f supabase/migrations/0001_jugnu_accounts.sql >/dev/null

echo "2/3 Admin emails…"
for email in "$@"; do
  case "$email" in *[\'\;\ ]*) echo "Skipping odd email: $email"; continue ;; esac
  $SB db query --remote="$REF" --yes \
    "insert into public.jugnu_admin_emails (email) values (lower('$email')) on conflict do nothing;
     update public.jugnu_profiles set is_admin = true where lower(email) = lower('$email');" >/dev/null
done

echo "3/3 jugnu-ai function…"
$SB functions deploy jugnu-ai --project-ref "$REF" --no-verify-jwt --use-api

echo "Done. Checking:"
$SB db query --remote="$REF" --read-only \
  "select (select count(*) from information_schema.tables where table_schema='public' and table_name like 'jugnu%') as jugnu_tables,
          (select string_agg(email, ', ') from public.jugnu_admin_emails) as admins;"
