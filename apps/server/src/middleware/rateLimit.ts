import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redisPub } from '../redis/client';

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later' },
  store: new RedisStore({
    sendCommand: (...args: string[]) => {
      const [command, ...rest] = args;
      return redisPub.call(command, ...rest) as Promise<string | number | boolean | (string | number | boolean)[]>;
    },
  }),
});
