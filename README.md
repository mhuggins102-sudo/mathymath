This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Daily leaderboard backend

The daily-puzzle leaderboard is backed by `lib/api/dailyStore.ts`. Without
configuration it uses an in-memory store (resets on restart, not shared
across server instances) — fine for development. For production, point it
at a Cloudflare D1 database.

1. Create the database (one-time):

   ```bash
   wrangler d1 create mathymath-daily
   ```

2. Apply the schema:

   ```bash
   wrangler d1 execute mathymath-daily --remote --file=scripts/d1-schema.sql
   ```

3. Set these env vars on the deployment (and locally in `.env.local` if
   you want to test the real backend in dev):

   ```
   CF_ACCOUNT_ID=...
   CF_D1_DATABASE_ID=...        # printed by `wrangler d1 create`
   CF_D1_API_TOKEN=...           # API token with D1 read+write
   ```

   On Cloudflare Pages, the two non-secret IDs (`CF_ACCOUNT_ID` and
   `CF_D1_DATABASE_ID`) are declared in [`wrangler.toml`](./wrangler.toml)
   under `[vars]` so they survive rebuilds. Fill in the placeholder
   values there before deploying. `CF_D1_API_TOKEN` is a secret —
   set it via the CF Pages dashboard's encrypted-variable type or
   `wrangler pages secret put CF_D1_API_TOKEN`, NOT in `wrangler.toml`.

When all three are present, `getDailyStore()` returns the D1 adapter
(`lib/api/dailyStoreD1.ts`); otherwise it falls back to the in-memory
store, so tests and local dev keep working with no setup.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
