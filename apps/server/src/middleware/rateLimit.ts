import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redisPub } from '../redis/client';

function limiter(windowMs: number, limit: number, message: string, prefix: string) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: message },
    store: new RedisStore({
      prefix,
      sendCommand: (...args: string[]) => {
        const [command, ...rest] = args;
        return redisPub.call(command, ...rest) as Promise<string | number | boolean | (string | number | boolean)[]>;
      },
    }),
  });
}

export const authRateLimit = limiter(15 * 60 * 1000, 10, 'Too many attempts, please try again later', 'rl:auth:');
export const runRateLimit = limiter(60 * 1000, 60, 'Too many runs, wait a moment', 'rl:run:');
