import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '../generated/prisma/client';
import { registerUser, loginUser, signToken } from '../services/authService';

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1),
});

authRouter.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  try {
    const user = await registerUser(parsed.data.email, parsed.data.password, parsed.data.displayName);
    res.status(201).json({ token: signToken(user.id) });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    throw err;
  }
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const user = await loginUser(parsed.data.email, parsed.data.password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  res.json({ token: signToken(user.id) });
});