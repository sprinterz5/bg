import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(4000),
  API_BASE_URL: z.string().url().default("http://localhost:4000"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
  JWT_SECRET: z.string().min(24),
  JWT_REFRESH_SECRET: z.string().min(24),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  APPLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_BOOKS_API_KEY: z.string().optional().default(""),
  OPEN_LIBRARY_BASE_URL: z.string().url().default("https://openlibrary.org"),
  MEDIA_STORAGE_DIR: z.string().default("storage/uploads"),
  PUBLIC_MEDIA_URL: z.string().url().default("http://localhost:4000/media"),
  CORS_ORIGIN: z.string().default("*")
});

export const env = envSchema.parse(process.env);

export const corsOrigins =
  env.CORS_ORIGIN === "*"
    ? true
    : env.CORS_ORIGIN.split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);
