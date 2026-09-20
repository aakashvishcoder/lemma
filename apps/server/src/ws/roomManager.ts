import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import type { WebSocket } from 'ws';
import { redisPub, redisSub } from '../redis/client';

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
const REDIS_ORIGIN = Symbol('redis');

function channelForRoom(roomId: string, kind: 'updates' | 'awareness'): string {
  return `room:${roomId}:${kind}`;
}

redisSub.psubscribe('room:*:updates', 'room:*:awareness');
redisSub.on('pmessageBuffer', (_pattern: string, channel: Buffer, message: Buffer) => {
  const [, roomId, kind] = channel.toString().split(':');
  const room = rooms.get(roomId);
  if (!room) return;
  if (kind === 'updates') {
    Y.applyUpdate(room.doc, new Uint8Array(message), REDIS_ORIGIN);
  } else if (kind === 'awareness') {
    applyAwarenessUpdate(room.awareness, new Uint8Array(message), REDIS_ORIGIN);
  }
});

interface Room {
  doc: Y.Doc;
  awareness: Awareness;
  sockets: Set<WebSocket>;
  awarenessClientIds: Map<WebSocket, Set<number>>;
}

const rooms = new Map<string, Room>();

function getRoom(roomId: string): Room {
  let room = rooms.get(roomId);
  if (room) return room;

  const doc = new Y.Doc();
  const awareness = new Awareness(doc);
  room = { doc, awareness, sockets: new Set(), awarenessClientIds: new Map() };
  rooms.set(roomId, room);

  doc.on('update', (update: Uint8Array, origin: unknown) => {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    const message = encoding.toUint8Array(encoder);

    for (const ws of room!.sockets) {
      if (ws !== origin && ws.readyState === ws.OPEN) {
        ws.send(message);
      }
    }

    if (origin !== REDIS_ORIGIN) {
      redisPub.publish(channelForRoom(roomId, 'updates'), Buffer.from(update));
    }
  });

  awareness.on(
    'update',
    (
      { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
      origin: unknown,
    ) => {
      if (origin instanceof Object && room!.sockets.has(origin as WebSocket)) {
        const ws = origin as WebSocket;
        let owned = room!.awarenessClientIds.get(ws);
        if (!owned) {
          owned = new Set();
          room!.awarenessClientIds.set(ws, owned);
        }
        for (const clientId of [...added, ...updated]) owned.add(clientId);
        for (const clientId of removed) owned.delete(clientId);
      }

      const changedClients = [...added, ...updated, ...removed];
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(encoder, encodeAwarenessUpdate(awareness, changedClients));
      const message = encoding.toUint8Array(encoder);

      for (const ws of room!.sockets) {
        if (ws !== origin && ws.readyState === ws.OPEN) {
          ws.send(message);
        }
      }

      if (origin !== REDIS_ORIGIN) {
        redisPub.publish(
          channelForRoom(roomId, 'awareness'),
          Buffer.from(encodeAwarenessUpdate(awareness, changedClients)),
        );
      }
    },
  );

  return room;
}

function send(ws: WebSocket, encoder: encoding.Encoder) {
  if (ws.readyState === ws.OPEN) {
    ws.send(encoding.toUint8Array(encoder));
  }
}

export function joinRoom(ws: WebSocket, roomId: string) {
  const room = getRoom(roomId);

  room.sockets.add(ws);
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_SYNC);

  syncProtocol.writeSyncStep1(encoder, room.doc);
  send(ws, encoder);

  const awarenessStates = room.awareness.getStates();
  if (awarenessStates.size > 0) {
    const awarenessEncoder = encoding.createEncoder();
    encoding.writeVarUint(awarenessEncoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(
      awarenessEncoder,
      encodeAwarenessUpdate(room.awareness, [...awarenessStates.keys()]),
    );
    send(ws, awarenessEncoder);
  }

  ws.on('message', (data: Buffer) => {
    const decoder = decoding.createDecoder(new Uint8Array(data));
    const messageType = decoding.readVarUint(decoder);

    if (messageType === MESSAGE_SYNC) {
      const reply = encoding.createEncoder();

      encoding.writeVarUint(reply, MESSAGE_SYNC);

      syncProtocol.readSyncMessage(decoder, reply, room.doc, ws);
      if (encoding.length(reply) > 1) {
        send(ws, reply);
      }
    } else if (messageType === MESSAGE_AWARENESS) {
      const update = decoding.readVarUint8Array(decoder);
      applyAwarenessUpdate(room.awareness, update, ws);
    }
  });

  ws.on('close', () => {
    room.sockets.delete(ws);
    const owned = room.awarenessClientIds.get(ws);
    if (owned && owned.size > 0) {
      removeAwarenessStates(room.awareness, [...owned], null);
    }
    room.awarenessClientIds.delete(ws);
    if (room.sockets.size === 0) {
      rooms.delete(roomId);
    }
  });
}
