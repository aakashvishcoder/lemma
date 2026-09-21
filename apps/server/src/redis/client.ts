import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { Redis } from 'ioredis';

const currentDir = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(currentDir, '../../.env') });

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

export const redisPub = new Redis(REDIS_URL);
export const redisSub = new Redis(REDIS_URL);