import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle-bootstrap",
  dialect: "mysql",
  dbCredentials: {
    url: connectionString,
  },
});
