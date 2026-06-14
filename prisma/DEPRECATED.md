# Deprecated

Prisma schema is no longer used. Source of truth has moved to `supabase/migrations/`.

Delete this entire directory in a separate commit once you've confirmed:
1. `supabase/migrations/` has the three timestamped migration files
2. `npm run build` is green without `@prisma/client` or `prisma` in package.json

To remove Prisma from the project:

```bash
npm uninstall @prisma/client prisma
rm -rf prisma
git add -A
git commit -m "chore: remove dead Prisma stack (Supabase CLI is now source of truth)"
```
