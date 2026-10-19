This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### Environment

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

Required variables for basic app + auth:

```bash
DATABASE_URL=postgres://...
BETTER_AUTH_SECRET=...          # Generate a secure random string
HC_IDENTITY_HOST=https://hca.dinosaurbbq.org
HC_IDENTITY_CLIENT_ID=...
HC_IDENTITY_CLIENT_SECRET=...
HC_IDENTITY_REDIRECT_URI=http://localhost:3000/api/auth/callback/hackclub-identity
NEXT_PUBLIC_APP_URL=http://localhost:3000
HACKATIME_OAUTH_CLIENT_ID=...
HACKATIME_OAUTH_CLIENT_SECRET=...
HACKATIME_OAUTH_REDIRECT_URI=http://localhost:3000/api/hackatime/oauth/callback
```

### Cloudflare R2 (image uploads)

This app uploads images (project screenshots, shop item images, editor icons) directly from the browser to **Cloudflare R2** using **presigned URLs**.

Add these to `.env.local` (all are environment variables so you can swap credentials quickly):

```bash
# Cloudflare R2 S3-compatible credentials + bucket
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=...

# S3-compatible endpoint (optional; default uses R2_ACCOUNT_ID)
# Example: https://<ACCOUNT_ID>.r2.cloudflarestorage.com
R2_ENDPOINT=

# Required: public base URL for reading objects (custom domain / r2.dev / worker route).
# This is what gets stored in the DB as the image URL.
R2_PUBLIC_BASE_URL=https://<your-public-domain-or-r2-dev-host>

# Optional (defaults to "auto" as recommended by Cloudflare)
R2_REGION=auto
```

You also need to configure your R2 bucket CORS to allow browser uploads from your app origin.
Because uploads are done with a **browser `PUT`** to the R2 endpoint, CORS must be configured on the bucket to allow your origins (dev + prod).

Use a CORS policy like this (adjust origins as needed):

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://your-prod-domain.com"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

### Slack notifications and automated nudges

All outbound Slack lives in `src/lib/notifications/` and runs through one paced client (`SLACK_BOT_TOKEN`; scopes `chat:write`, `im:write`, `users:read`).

- **Creator DMs** on submit, reviewer feedback/rejection, and grant (`review-events.ts`). Pass-1 approval is deliberately silent; the creator hears "approved" only when tokens are credited.
- **Staff review channel** (`SLACK_REVIEW_CHANNEL_ID`, bot must be invited): one post per submission or resubmission, with reviewer decisions, creator replies and the grant threaded under it. Preview the copy without touching the database:

  ```bash
  bun scripts/notifications/post-sample.ts C0123456789
  ```

- **Automated nudges** (`nudges/`): daily DMs to people who look stuck (hours logged but never submitted, project with no devlogs, Hackatime connected but no project, never connected). One per person per day, at most two per topic, none within 7 days of any other nudge, and nothing after the `carnival_deadline` site setting. Admins see today's plan on `/admin/insights`.

  The run is a one-shot command bundled into the app image as `scripts/nudges.js`. A Coolify **Scheduled Task** on the Carnival app runs it inside the container:

  | Setting | Value |
  |---|---|
  | Command | `bun scripts/nudges.js --send` |
  | Frequency | `0 16 * * *` (16:00 UTC daily) |
  | Timeout | 600 seconds |

  Without `--send`, or without `NUDGES_ENABLED=true` on the app, the command only prints the plan. `NUDGES_TEST_SLACK_IDS` restricts sends to listed Slack IDs for a first live test, and `NUDGES_MAX_PER_RUN` caps a run (default 200 at 1 message/second). A Postgres advisory lock stops two runs overlapping, and a failed run exits non-zero so Coolify can alert.

  ```bash
  bun scripts/nudges/run.ts                  # locally: dry run, counts + sample copy
  bun scripts/nudges.js --send --max 25 --allow U0123456789   # in the container
  ```

  **Opting people out.** Every nudge says people can turn reminders off on `/account` or DM the contact in `NUDGES_CONTACT_SLACK_ID` on Slack. To stop someone by hand:

  ```sql
  update "user" set slack_nudges_opt_out = true where slack_id = 'U0123456789';
  ```

### Database

Before starting the app, sync the database schema (this creates/help-updates tables like `verification` used by Better Auth):

```bash
bun run db:push
```

### Run the app

Run the development server:

```bash
bun dev
```

(Or use `npm run dev`, `yarn dev`, or `pnpm dev` if you prefer.)

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
