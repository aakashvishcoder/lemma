import * as Y from 'yjs';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/db/client';

async function main() {
  const passwordHash = await bcrypt.hash('seed-password', 10);
  const user = await prisma.user.upsert({
    where: { email: 'seed@example.com' },
    update: {},
    create: { email: 'seed@example.com', passwordHash, displayName: 'Seed User' },
  });

  const room = await prisma.room.upsert({
    where: { inviteCode: 'demo-room' },
    update: {},
    create: { name: 'Demo Room', ownerId: user.id, inviteCode: 'demo-room' },
  });

  await prisma.roomMember.upsert({
    where: { roomId_userId: { roomId: room.id, userId: user.id } },
    update: {},
    create: { roomId: room.id, userId: user.id, role: 'owner' },
  });

  const existingDocument = await prisma.document.findFirst({ where: { roomId: room.id } });
  if (existingDocument) {
    console.log('Seed document already exists:', existingDocument.id);
    return;
  }

  const doc = new Y.Doc();
  doc.getText('content').insert(0, '// start typing...');
  const snapshot = Buffer.from(Y.encodeStateAsUpdate(doc));

  const document = await prisma.document.create({
    data: { roomId: room.id, filename: 'main.ts', snapshot },
  });

  console.log('Seeded document id:', document.id);
  console.log('Seed user: seed@example.com / seed-password');
}

main().finally(() => prisma.$disconnect());