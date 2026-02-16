import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { env } from "@/lib/env";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = env.DATABASE_URL;
  const needsSsl =
    connectionString.includes("rds.amazonaws.com") || connectionString.includes("sslmode=require");

  // Strip sslmode from URL to avoid conflict with explicit ssl config
  const cleanUrl = needsSsl
    ? connectionString.replace(/[?&]sslmode=[^&]*/g, "").replace(/\?$/, "")
    : connectionString;

  const pool = new pg.Pool({
    connectionString: cleanUrl,
    ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  });

  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") globalForPrisma.prisma = db;
