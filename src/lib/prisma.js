// ──────────────────────────────────────────────
// Prisma Client — Singleton Instance (Prisma 7 + Driver Adapter)
// ──────────────────────────────────────────────
const { PrismaClient } = require('../generated/prisma');
const { PrismaPg } = require('@prisma/adapter-pg');

// Create a Prisma Postgres driver adapter
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

const prisma = new PrismaClient({ adapter });

module.exports = prisma;
