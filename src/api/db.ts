import mongoose from "mongoose";

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as typeof globalThis & {
  mongooseCache?: MongooseCache;
};

const mongooseCache: MongooseCache = globalForMongoose.mongooseCache ?? {
  conn: null,
  promise: null,
};

globalForMongoose.mongooseCache = mongooseCache;

export async function connectDb(mongoUri: string) {
  if (!mongoUri) {
    throw new Error("MONGODB_URI is required");
  }

  if (mongooseCache.conn && mongoose.connection.readyState === 1) {
    return mongooseCache.conn;
  }

  // Clear stale connection so we rebuild it on next request
  if (mongooseCache.conn && mongoose.connection.readyState !== 1) {
    mongooseCache.conn = null;
    mongooseCache.promise = null;
  }

  if (!mongooseCache.promise) {
    mongoose.set("bufferCommands", true);

    // On Vercel serverless the function timeout is 10s (Hobby) or 60s (Pro).
    // Using 30s timeouts on Hobby means Mongoose keeps waiting until Vercel
    // kills the request with a silent 504. Use 8s on Vercel so the app can
    // return a clean 503 before the executor terminates the function.
    // On Railway (long-running process) we keep the generous 30s.
    const isVercel = Boolean(process.env.VERCEL);
    const serverSelectionTimeoutMS = isVercel ? 8000 : 30000;
    const connectTimeoutMS = isVercel ? 8000 : 30000;
    const socketTimeoutMS = isVercel ? 15000 : 45000;

    // On Vercel each serverless invocation gets its own process (and its own
    // connection pool). Keeping the pool tiny (1–5) prevents hundreds of
    // concurrent Lambda instances from exhausting the Atlas M0 connection
    // limit (500 total). On Railway the server is long-running so a slightly
    // larger pool is fine, but still keep it modest for a personal app.
    const maxPoolSize = isVercel ? 1 : 5;

    mongooseCache.promise = mongoose
      .connect(mongoUri, {
        serverSelectionTimeoutMS,
        connectTimeoutMS,
        socketTimeoutMS,
        // Heartbeat keeps the TCP connection alive so Atlas doesn't silently
        // drop idle connections (free tier M0 idles out quickly).
        // Use a longer interval on Vercel — serverless functions are short-lived
        // so a fast heartbeat would just waste connections.
        heartbeatFrequencyMS: isVercel ? 30000 : 10000,
        family: 4,
        // --- Connection pool limits (KEY FIX for Atlas M0 connection alerts) ---
        // maxPoolSize: limits how many sockets each server node can open.
        // On Vercel (serverless) keep it at 1 — each function invocation is
        // short-lived and only ever uses one connection at a time.
        maxPoolSize,
        // minPoolSize 0: idle connections are closed immediately rather than
        // kept open, which is correct for serverless where the process exits.
        minPoolSize: 0,
        // "auto" lets the driver pick the right monitoring mode:
        // stream  → for long-lived servers (Railway)
        // poll    → for serverless / short-lived processes (Vercel)
        // This avoids an extra monitoring socket being held open per invocation.
        serverMonitoringMode: "auto",
      })
      .then((m) => {
        mongooseCache.conn = m;
        return m;
      })
      .catch((err) => {
        mongooseCache.promise = null;
        mongooseCache.conn = null;
        throw err;
      });
  }

  return await mongooseCache.promise;
}
