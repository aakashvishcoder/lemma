import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { attachWebSocketServer } from '../index';
import { prisma } from '../../db/client';
import { createRoom, joinRoomByInviteCode } from '../../services/roomService';
import { registerUser, signToken } from '../../services/authService';

const MESSAGE_SYNC = 0;

function waitForContent(doc: Y.Doc, predicate: (text: string) => boolean, timeoutMs = 5000): Promise<string> {
  return new Promise((resolve, reject) => {
    const check = () => {
      const text = doc.getText('content').toString();
      if (predicate(text)) {
        cleanup();
        resolve(text);
      }
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for content. Last seen: ${JSON.stringify(doc.getText('content').toString())}`));
    }, timeoutMs);
    const cleanup = () => {
      clearTimeout(timer);
      doc.off('update', check);
    };
    doc.on('update', check);
    check();
  });
}

function connectTestClient(port: number, roomId: string, token: string, doc: Y.Doc): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}?roomId=${roomId}&token=${token}`);

    ws.on('open', () => {
      // The client must initiate with its own SyncStep1 so the server can
      // reply with SyncStep2 containing the room's existing content - see
      // the identical comment in apps/web/src/editor/yjsProvider.ts.
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.writeSyncStep1(encoder, doc);
      ws.send(encoding.toUint8Array(encoder));
    });

    ws.on('message', (data: Buffer) => {
      const decoder = decoding.createDecoder(new Uint8Array(data));
      const messageType = decoding.readVarUint(decoder);
      if (messageType === MESSAGE_SYNC) {
        const reply = encoding.createEncoder();
        encoding.writeVarUint(reply, MESSAGE_SYNC);
        syncProtocol.readSyncMessage(decoder, reply, doc, ws);
        if (encoding.length(reply) > 1) ws.send(encoding.toUint8Array(reply));
      }
    });

    doc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin === ws) return;
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.writeUpdate(encoder, update);
      if (ws.readyState === WebSocket.OPEN) ws.send(encoding.toUint8Array(encoder));
    });

    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

describe('room sync over real WebSocket connections', () => {
  let port: number;
  let httpServer: ReturnType<typeof createServer>;
  let roomId: string;
  const userIds: string[] = [];
  const tokens: string[] = [];

  beforeAll(async () => {
    httpServer = createServer();
    attachWebSocketServer(httpServer);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    port = (httpServer.address() as AddressInfo).port;

    const suffix = Date.now();
    const owner = await registerUser(`ws-owner-${suffix}@example.com`, 'password123', 'Owner');
    const room = await createRoom(owner.id, 'WS Test Room');
    roomId = room.id;
    userIds.push(owner.id);
    tokens.push(signToken(owner.id));

    for (let i = 0; i < 2; i++) {
      const member = await registerUser(`ws-member-${i}-${suffix}@example.com`, 'password123', `Member ${i}`);
      await joinRoomByInviteCode(member.id, room.inviteCode);
      userIds.push(member.id);
      tokens.push(signToken(member.id));
    }
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    await prisma.roomMember.deleteMany({ where: { roomId } });
    await prisma.room.delete({ where: { id: roomId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  it('converges 3 concurrent clients editing the same room', async () => {
    const docA = new Y.Doc();
    const docB = new Y.Doc();
    const docC = new Y.Doc();

    const [wsA, wsB, wsC] = await Promise.all([
      connectTestClient(port, roomId, tokens[0], docA),
      connectTestClient(port, roomId, tokens[1], docB),
      connectTestClient(port, roomId, tokens[2], docC),
    ]);

    try {
      docA.getText('content').insert(0, 'from A');
      docB.getText('content').insert(0, 'from B');

      const hasBothEdits = (text: string) => text.includes('from A') && text.includes('from B');
      await Promise.all([
        waitForContent(docA, hasBothEdits),
        waitForContent(docB, hasBothEdits),
        waitForContent(docC, hasBothEdits),
      ]);

      const finalText = docA.getText('content').toString();
      expect(docB.getText('content').toString()).toBe(finalText);
      expect(docC.getText('content').toString()).toBe(finalText);
    } finally {
      wsA.close();
      wsB.close();
      wsC.close();
    }
  });

  it('a client joining after content already exists receives it', async () => {
    const freshRoom = await createRoom(userIds[0], 'Fresh Room For Pre-existing Content Test');
    await joinRoomByInviteCode(userIds[1], freshRoom.inviteCode);

    try {
      const docA = new Y.Doc();
      const wsA = await connectTestClient(port, freshRoom.id, tokens[0], docA);

      try {
        docA.getText('content').insert(0, 'pre-existing content');
        await waitForContent(docA, (t) => t === 'pre-existing content');

        const docB = new Y.Doc();
        const wsB = await connectTestClient(port, freshRoom.id, tokens[1], docB);
        try {
          const received = await waitForContent(docB, (t) => t === 'pre-existing content');
          expect(received).toBe('pre-existing content');
        } finally {
          wsB.close();
        }
      } finally {
        wsA.close();
      }
    } finally {
      await prisma.roomMember.deleteMany({ where: { roomId: freshRoom.id } });
      await prisma.room.delete({ where: { id: freshRoom.id } });
    }
  });

  it('rejects a connection with no token', async () => {
    await expect(
      new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${port}?roomId=${roomId}`);
        ws.on('open', () => reject(new Error('connection should not have opened')));
        ws.on('error', resolve);
      }),
    ).resolves.toBeInstanceOf(Error);
  });
});