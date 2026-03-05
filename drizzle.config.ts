import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL || "";
const isPostgres = databaseUrl.startsWith("postgres");

export default defineConfig(
  isPostgres
    ? {
        schema: "./src/lib/db/schema.ts",
        out: "./drizzle-pg",
        dialect: "postgresql",
        dbCredentials: { url: databaseUrl },
      }
    : {
        schema: "./src/lib/db/schema.ts",
        out: "./drizzle",
        dialect: "sqlite",
        dbCredentials: { url: "./data/database.db" },
      }
);
