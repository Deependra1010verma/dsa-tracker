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

    mongooseCache.promise = mongoose
      .connect(mongoUri, {
        serverSelectionTimeoutMS,
        connectTimeoutMS,
        socketTimeoutMS,
        // Heartbeat keeps the TCP connection alive so Atlas doesn't silently
        // drop idle connections (free tier M0 idles out quickly).
        heartbeatFrequencyMS: 10000,
        family: 4,
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
