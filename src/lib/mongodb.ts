import mongoose from "mongoose";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

const g = globalThis as typeof globalThis & {
  __mongoose?: MongooseCache;
};

const cache: MongooseCache = g.__mongoose ?? {
  conn: null,
  promise: null,
};

/** Always pin the cache on globalThis so Next.js production bundles share one connection. */
if (!g.__mongoose) {
  g.__mongoose = cache;
}

export default async function connectDB(): Promise<typeof mongoose> {
  /** Read at call time so scripts can `dotenv.config()` before importing this module. */
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "Please define MONGODB_URI in .env.local (e.g. mongodb://127.0.0.1:27017/operation-automation)",
    );
  }
  if (cache.conn) return cache.conn;
  if (!cache.promise) {
    cache.promise = mongoose.connect(uri, {
      /** Queue commands until connect completes (avoids races with bufferCommands=false). */
      bufferCommands: true,
    });
  }
  cache.conn = await cache.promise;
  return cache.conn;
}
