import mongoose from "mongoose";

export async function connectDb(mongoUri: string) {
  if (!mongoUri) {
    throw new Error("MONGODB_URI is required");
  }

  await mongoose.connect(mongoUri);
}

