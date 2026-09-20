import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { createRoom, listRoomsForUser, joinRoomByInviteCode } from '../services/roomService';

export const roomsRouter = Router();
roomsRouter.use(requireAuth);

const createRoomSchema = z.object({
  name: z.string().min(1),
  isPublic: z.boolean().optional(),
});

roomsRouter.post('/', async (req, res) => {
  const parsed = createRoomSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const room = await createRoom(req.userId!, parsed.data.name, parsed.data.isPublic);
  res.status(201).json(room);
});

roomsRouter.get('/', async (req, res) => {
  res.json(await listRoomsForUser(req.userId!));
});

const joinSchema = z.object({ inviteCode: z.string() });

roomsRouter.post('/join', async (req, res) => {
  const parsed = joinSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const room = await joinRoomByInviteCode(req.userId!, parsed.data.inviteCode);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  res.json(room);
});