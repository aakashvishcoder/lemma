import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';

const MESSAGE_SYNC = 0;

export function connectYjsRoom(roomId: string, token: string, doc: Y.Doc): () => void {
  const ws = new WebSocket(`ws://localhost:3001?roomId=${roomId}&token=${token}`);
  ws.binaryType = 'arraybuffer';

  ws.addEventListener('open', () => {
    // Per y-protocols/sync's own client-server model: the CLIENT must
    // initiate with its own SyncStep1 so the server can reply with
    // SyncStep2 (the room's actual existing content). Without this, only
    // live updates after joining ever arrive - a room's pre-existing
    // content at join-time is never requested at all.
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(encoder, doc);
    ws.send(encoding.toUint8Array(encoder));
  });

  ws.addEventListener('message', (event) => {
    const decoder = decoding.createDecoder(new Uint8Array(event.data as ArrayBuffer));
    const messageType = decoding.readVarUint(decoder);
    if (messageType === MESSAGE_SYNC) {
      const reply = encoding.createEncoder();
      encoding.writeVarUint(reply, MESSAGE_SYNC);
      syncProtocol.readSyncMessage(decoder, reply, doc, ws);
      if (encoding.length(reply) > 1) {
        ws.send(encoding.toUint8Array(reply));
      }
    }
  });

  const onDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === ws) return;
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(encoding.toUint8Array(encoder));
    }
  };
  doc.on('update', onDocUpdate);

  return () => {
    doc.off('update', onDocUpdate);
    ws.close();
  };
}