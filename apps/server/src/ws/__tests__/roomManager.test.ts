import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { attachWebSocketServer } from '../index';

const MESSAGE_SYNC = 0;

function connectTestClient(port: number, roomId: string, doc: Y.Doc): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}?roomId=${roomId}`);

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

  beforeAll(async () => {
    httpServer = createServer();
    attachWebSocketServer(httpServer);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    port = (httpServer.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it('converges 3 concurrent clients editing the same room', async () => {
    const roomId = `test-room-${Date.now()}`;
    const docA = new Y.Doc();
    const docB = new Y.Doc();
    const docC = new Y.Doc();

    const [wsA, wsB, wsC] = await Promise.all([
      connectTestClient(port, roomId, docA),
      connectTestClient(port, roomId, docB),
      connectTestClient(port, roomId, docC),
    ]);

    // Deliberately concurrent: both insert at index 0 before seeing
    // each other's edit, same kind of tie the CRDT convergence test covers.
    docA.getText('content').insert(0, 'from A');
    docB.getText('content').insert(0, 'from B');

    await new Promise((r) => setTimeout(r, 300));

    const finalText = docA.getText('content').toString();
    expect(docB.getText('content').toString()).toBe(finalText);
    expect(docC.getText('content').toString()).toBe(finalText);

    wsA.close();
    wsB.close();
    wsC.close();
  });
});