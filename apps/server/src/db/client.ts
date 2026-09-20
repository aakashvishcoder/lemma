import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '../generated/prisma/client';

const currentDir = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(currentDir, '../../.env') });

export const prisma = new PrismaClient();
