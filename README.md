# DSA Tracker

Personal MERN tracker for DSA practice.

## What it does

- Tracks topics and question records
- Stores status: solved, unsolved, revisit, skipped
- Stores short notes and long notes
- Saves external platform links
- Shows topic progress and spaced repetition revision queue
- Schedules next revisions at 1, 3, 7, 15, and 30 days after a solve/review

## Structure

- `src/api` - Shared MongoDB models, seeds, and API logic
- `api/[...path].ts` - Vercel serverless API entrypoint
- `src` - React + Vite UI

## Run locally

1. Create `.env`

```env
MONGODB_URI=mongodb://127.0.0.1:27017/dsa-tracker
PORT=4000
```

2. Install dependencies

3. Start the app

```bash
npm run dev
```

## Notes

- A simple local login gate is included for the dashboard.
- This is designed for single-user personal use.

## Deploying to Vercel

Set these environment variables in your Vercel project:

```env
MONGODB_URI=your_mongodb_connection_string
USERNAME=your_login_username
PASSWORD=your_login_password
```

Build output is configured for `dist/web`, and `/api/*` routes are served by the
serverless function in `api/[...path].ts`.
