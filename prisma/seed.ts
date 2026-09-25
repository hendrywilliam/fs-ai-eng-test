#!/usr/bin/env tsx

import { randomBytes } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '../src/generated/prisma/client.js';

loadEnv();

const API_KEY_PREFIX = 'api_key_';
const API_KEY_BYTES = 32;

const DEMO_ORGANIZATION_NAMES = ['GoodevaDesk Demo', 'Acme Corp'];

function generateApiKey(): string {
  return `${API_KEY_PREFIX}${randomBytes(API_KEY_BYTES).toString('hex')}`;
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env first.',
    );
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    for (const name of DEMO_ORGANIZATION_NAMES) {
      const existing = await prisma.organization.findFirst({ where: { name } });

      if (existing) {
        console.log(
          `Organization "${name}" already exists (x-api-key: ${existing.apiKey})`,
        );
        continue;
      }

      const created = await prisma.organization.create({
        data: { name, apiKey: generateApiKey() },
      });

      console.log(
        `Created organization "${created.name}" (x-api-key: ${created.apiKey})`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

await main();
