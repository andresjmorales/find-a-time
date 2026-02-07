This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

These steps work in PowerShell (pwsh), Windows Command Prompt, and common Unix shells.

1. **Install dependencies** (required before running the dev server):

   ```powershell
   npm install
   ```

2. **Start the development server:**

   ```powershell
   npm run dev
   ```

   Or with another package manager: `yarn dev`, `pnpm dev`, or `bun dev`.

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The app needs **persistent storage** in production. Vercel’s serverless environment has no writable disk, so events are stored in **Upstash Redis**.

1. Deploy the app to [Vercel](https://vercel.com/new).
2. In the Vercel project, go to **Storage** (or **Integrations**) and add **Upstash Redis** (create a database if needed).
3. After you **Connect to Project**, Vercel may set either `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` or `KV_REST_API_URL`/`KV_REST_API_TOKEN`. The app supports both. Redeploy so the new env vars are used.

If those env vars are missing, “Find a time” will return an error and the UI will show the message from the server (e.g. to configure Upstash Redis).

**Local dev:** Without Redis env vars, the app uses a local `data/events.json` file so you can run and test locally without setting up Redis.
