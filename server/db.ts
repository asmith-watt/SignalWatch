import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("=====================================");
  console.error("DATABASE CONNECTION ERROR");
  console.error("=====================================");
  console.error("DATABASE_URL must be set.");
  console.error("For deployments, ensure database secrets are configured in Deployment settings.");
  console.error("=====================================");
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: databaseUrl });

// Test connection on startup
pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

export const db = drizzle(pool, { schema });
