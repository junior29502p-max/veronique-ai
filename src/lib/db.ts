import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";

// Database client that works in BOTH environments:
//
//   • Dev local   → SQLite file (DATABASE_URL=file:...) — no setup needed.
//   • Prod Vercel → Turso (libSQL) over the network — set TURSO_DATABASE_URL
//                   and TURSO_AUTH_TOKEN in the Vercel project env vars.
//
// Vercel's serverless functions have no persistent filesystem, so the local
// SQLite file approach can't work there. Turso is a free, edge-hosted
// SQLite-compatible database that Prisma talks to via the libSQL adapter.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (tursoUrl && tursoToken) {
    // --- Production: Turso (libSQL) ---
    const libsql = createClient({
      url: tursoUrl,
      authToken: tursoToken,
    });
    const adapter = new PrismaLibSql(libsql);
    return new PrismaClient({ adapter });
  }

  // --- Dev: local SQLite file ---
  return new PrismaClient({
    log: process.env.NODE_ENV !== "production" ? ["query", "error", "warn"] : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
