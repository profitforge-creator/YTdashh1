#!/usr/bin/env bash
# One-command local setup: writes .env.local, installs deps, seeds demo data, starts the dev server.
# You only need the service-role key from Supabase -> Settings -> API (it is a secret, so it isn't in the repo).
set -euo pipefail
cd "$(dirname "$0")/.."

URL="https://kevabrxuyfjaigdymlxc.supabase.co"
# Public anon key for this project (safe to ship to browsers by design).
ANON="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtldmFicnh1eWZqYWlnZHltbHhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyNzA4NDAsImV4cCI6MjEwNjg0Njg0MH0.xN97JrVpnseof5UfrLT9DIbHyTM58GsUgPs8ZzDpyVI"

if [ ! -f .env.local ]; then
  read -r -s -p "Paste your Supabase service_role key (hidden): " SERVICE; echo
  read -r -s -p "Choose a demo-account password (12+ chars): " DEMO_PW; echo
  [ "${#DEMO_PW}" -ge 12 ] || { echo "Password must be at least 12 characters."; exit 1; }
  umask 077
  cat > .env.local <<ENV
NEXT_PUBLIC_SUPABASE_URL=$URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_SERVICE_ROLE_KEY=$SERVICE
AI_MODE=fixtures
PAYMENTS_MODE=test
SEED_DEMO_PASSWORD=$DEMO_PW
ENV
  echo "Wrote .env.local"
fi

npm install
npm run seed
echo
echo "Open http://localhost:3000  ->  sign in as demo@devmint.example (the password you just chose)"
echo "Reminder: Supabase -> Authentication -> Providers -> Email -> turn OFF 'Confirm email' to sign up new accounts locally."
npm run dev
