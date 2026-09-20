import { randomBytes } from 'node:crypto';
import { prisma } from '../db/client';

function generateInviteCode(): string {
  return randomBytes(6).toString('hex');
}

export async function createRoom(ownerId: string, name: string, isPublic = false) {
  const room = await prisma.room.create({
    data: { name, ownerId, isPublic, inviteCode: generateInviteCode() },
  });
  await prisma.roomMember.create({
    data: { roomId: room.id, userId: ownerId, role: 'owner' },
  });
  return room;
}

export async function listRoomsForUser(userId: string) {
  const memberships = await prisma.roomMember.findMany({
    where: { userId },
    include: { room: true },
  });
  return memberships.map((m) => m.room);
}

export async function joinRoomByInviteCode(userId: string, inviteCode: string) {
  const room = await prisma.room.findUnique({ where: { inviteCode } });
  if (!room) return null;

  const existing = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId: room.id, userId } },
  });
  if (!existing) {
    await prisma.roomMember.create({ data: { roomId: room.id, userId, role: 'editor' } });
  }
  return room;
}

export async function isRoomMember(userId: string, roomId: string): Promise<boolean> {
  const member = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId } },
  });
  return member !== null;
}