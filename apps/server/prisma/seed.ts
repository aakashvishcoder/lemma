import * as Y from 'yjs';
import { prisma } from '../src/db/client';

async function main() {
  const doc = new Y.Doc();
  doc.getText('content').insert(0, '// start typing...');
  const snapshot = Buffer.from(Y.encodeStateAsUpdate(doc));

  const room = await prisma.room.create({
    data: { name: 'Demo Room', ownerId: 'seed-user', inviteCode: 'demo-room' },
  });

  const document = await prisma.document.create({
    data: { roomId: room.id, filename: 'main.ts', snapshot },
  });

  console.log('Seeded document id:', document.id);
}

main().finally(() => prisma.$disconnect());
