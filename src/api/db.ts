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

  if (!mongooseCache.promise) {
    mongoose.set("bufferCommands", true);
    mongooseCache.promise = mongoose
      .connect(mongoUri, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
        socketTimeoutMS: 20000,
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
