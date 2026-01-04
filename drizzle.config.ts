import { defineConfig } from "drizzle-kit";
import { config as loadEnv } from "dotenv";

// Load env for drizzle-kit runs (prefer `.env.local` over `.env`).
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      (() => {
        throw new Error(
          "DATABASE_URL is not set. Put it in .env.local (recommended) or export it in your shell.",
        );
      })(),
  },
});
