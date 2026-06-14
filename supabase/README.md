# Supabase migrations

This directory is the source of truth for the live Supabase schema. Replaces
the dead `prisma/` directory (kept temporarily as a stub; delete in a separate
commit once you're comfortable).

## Workflow

```
# Install Supabase CLI once:
npm install -g supabase

# Link this project to your remote Supabase instance:
supabase link --project-ref <your-project-ref>

# Apply all migrations in order to the linked remote:
supabase db push

# Pull the remote schema state into a new local migration:
supabase db pull

# Create a new empty migration with a timestamped filename:
supabase migration new <name>
```

## Files

Migrations apply in lexicographic order. The `YYYYMMDDHHMMSS_name.sql` prefix
guarantees that order matches creation time.

To populate this directory with the migrations from the build phases, copy
these SQL files (downloaded from your Claude session) into `supabase/migrations/`
with timestamped filenames:

| Source SQL file | Target filename |
|---|---|
| 2026-06-13_goal_machine_runtime_contract.sql | 20260613000001_runtime_contract.sql |
| 2026-06-13_phase11_daily_loop.sql            | 20260613000002_phase11_daily_loop.sql |
| 2026-06-13_phase_a_auth_rls.sql              | 20260613000003_phase_a_auth_rls.sql |

These files were applied directly via the Supabase SQL Editor during the build
phases. Once they live in this directory, future environments can be reproduced
by running `supabase db push` instead of pasting SQL by hand.
