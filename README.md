# CareBoard

CareBoard is a private household chore tracker for coordinating care workers. A manager can create and assign chores, while each worker has a separate profile to claim open work and record completion. The activity log shows who handled each task and when.

## Local development

```bash
npm install
npm run db:generate
npm run build
npx wrangler d1 execute site-creator-d1 --local --file=drizzle/0000_narrow_madrox.sql --config=dist/server/wrangler.json
npm run start
```

The local site runs at `http://127.0.0.1:8787`.

## Technology

- React 19 and TypeScript
- Vinext and Vite
- Tailwind CSS 4, shadcn/Base UI, and Lucide icons
- Cloudflare D1 with Drizzle schema migrations
- Cloudflare Workers and OpenAI Sites hosting
