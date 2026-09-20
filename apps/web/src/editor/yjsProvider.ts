import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';

const MESSAGE_SYNC = 0;

export function connectYjsRoom(roomId: string, doc: Y.Doc): () => void {
  const ws = new WebSocket(`ws://localhost:3001?roomId=${roomId}`);
  ws.binaryType = 'arraybuffer';

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