# DSA Tracker

Personal MERN tracker for DSA practice.

## What it does

- Tracks topics and question records
- Stores status: solved, unsolved, revisit, skipped
- Stores short notes and long notes
- Saves external platform links
- Shows topic progress and revision queue

## Structure

- `src/api` - Express + MongoDB API
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

- No login/auth is included.
- This is designed for single-user personal use.
