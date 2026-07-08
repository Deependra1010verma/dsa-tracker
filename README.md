# DSA Tracker

Personal MERN tracker for DSA practice.

## What it does

- Tracks topics and question records
- Stores status: solved, unsolved, revisit, skipped
- Stores short notes and long notes
- Saves external platform links
- Shows topic progress and revision queue

## Structure

- `server` - Express + MongoDB API
- `client` - React + Vite UI

## Run locally

1. Create `server/.env`

```env
MONGODB_URI=mongodb://127.0.0.1:27017/dsa-tracker
PORT=4000
```

2. Install dependencies in both apps

3. Start the server and client

```bash
npm run dev:server
npm run dev:client
```

## Notes

- No login/auth is included.
- This is designed for single-user personal use.

