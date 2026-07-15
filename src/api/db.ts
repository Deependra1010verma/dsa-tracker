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
    mongoose.set("bufferCommands", false);
    mongooseCache.promise = mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 3000,
      socketTimeoutMS: 5000,
      family: 4,
    });
  }

  mongooseCache.conn = await mongooseCache.promise;
  return mongooseCache.conn;
}
