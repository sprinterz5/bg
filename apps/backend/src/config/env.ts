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
  // Comma-separated OAuth client ids whose Google ID tokens we accept (web, iOS, Android).
  GOOGLE_CLIENT_IDS: z.string().optional().default(""),
  GOOGLE_BOOKS_API_KEY: z.string().optional().default(""),
  OPEN_LIBRARY_BASE_URL: z.string().url().default("https://openlibrary.org"),
  EMAIL_PROVIDER: z.enum(["LOG", "RESEND"]).default("LOG"),
  RESEND_API_KEY: z.string().optional().default(""),
  RESEND_BASE_URL: z.string().url().default("https://api.resend.com"),
  EMAIL_FROM: z.string().email().default("no-reply@bookgram.dev"),
  EMAIL_VERIFY_URL: z.string().url().default("http://localhost:4000/auth/email/verify"),
  PASSWORD_RESET_URL: z.string().url().default("http://localhost:4000/auth/password/reset"),
  PUSH_DELIVERY_MODE: z.enum(["LOG", "DISABLED"]).default("LOG"),
  APNS_TEAM_ID: z.string().optional().default(""),
  APNS_KEY_ID: z.string().optional().default(""),
  APNS_BUNDLE_ID: z.string().optional().default(""),
  APNS_PRIVATE_KEY_PATH: z.string().optional().default(""),
  JOB_RUNNER_ENABLED: z.coerce.boolean().default(false),
  JOB_RUN_ON_STARTUP: z.coerce.boolean().default(false),
  JOB_SPAM_SCORE_INTERVAL_MINUTES: z.coerce.number().int().positive().default(60),
  JOB_SPAM_SCORE_LIMIT: z.coerce.number().int().positive().default(200),
  JOB_SPAM_SCORE_THRESHOLD: z.coerce.number().min(1).max(100).default(70),
  JOB_MAINTENANCE_INTERVAL_MINUTES: z.coerce.number().int().positive().default(30),
  JOB_BOOK_SIMILARITY_LIMIT: z.coerce.number().int().positive().default(50),
  AI_ENABLED: z.coerce.boolean().default(false),
  AI_PROVIDER: z.enum(["DISABLED", "LOCAL_HASH", "OPENAI_COMPATIBLE"]).default("DISABLED"),
  AI_BASE_URL: z.string().url().optional().default("https://api.openai.com/v1"),
  AI_API_KEY: z.string().optional().default(""),
  AI_EMBEDDING_MODEL: z.string().min(1).default("bookgram-local-hash-embedding-v1"),
  AI_EMBEDDING_DIMENSIONS: z.coerce.number().int().min(16).max(4096).default(256),
  JOB_AI_EMBEDDINGS_INTERVAL_MINUTES: z.coerce.number().int().positive().default(120),
  JOB_AI_EMBEDDINGS_LIMIT: z.coerce.number().int().positive().default(50),
  MEDIA_STORAGE_DIR: z.string().default("storage/uploads"),
  MEDIA_STORAGE_PROVIDER: z.enum(["LOCAL", "R2", "S3"]).default("LOCAL"),
  MEDIA_BUCKET: z.string().optional().default(""),
  MEDIA_REGION: z.string().optional().default("auto"),
  MEDIA_ENDPOINT: z.string().optional().default(""),
  MEDIA_ACCESS_KEY_ID: z.string().optional().default(""),
  MEDIA_SECRET_ACCESS_KEY: z.string().optional().default(""),
  MEDIA_PUBLIC_BASE_URL: z.string().url().optional().default(""),
  MEDIA_MODERATION_PROVIDER: z.enum(["DISABLED", "LOCAL_STUB", "OPENAI", "GOOGLE_VISION", "AWS_REKOGNITION", "HIVE"]).default("DISABLED"),
  MEDIA_MODERATION_DEFAULT_STATUS: z.enum(["APPROVED", "PENDING"]).default("APPROVED"),
  MEDIA_MODERATION_REVIEW_THRESHOLD: z.coerce.number().min(0).max(1).default(0.65),
  MEDIA_MODERATION_REJECT_THRESHOLD: z.coerce.number().min(0).max(1).default(0.9),
  JOB_CLEANUP_INTERVAL_MINUTES: z.coerce.number().int().positive().default(360),
  JOB_IDEMPOTENCY_RETENTION_HOURS: z.coerce.number().int().positive().default(24),
  JOB_RUN_RETENTION_DAYS: z.coerce.number().int().positive().default(14),
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
