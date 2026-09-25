import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { WS_BASE } from '../config';

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
const REMOTE_AWARENESS_ORIGIN = 'remote-awareness';

export function connectYjsRoom(roomId: string, token: string, doc: Y.Doc, awareness: Awareness): () => void {
  const ws = new WebSocket(`${WS_BASE}?roomId=${roomId}&token=${token}`);
  ws.binaryType = 'arraybuffer';

  // setLocalStateField() (called by y-monaco to publish cursor/selection)
  // is a silent no-op until local state is non-null. This has to be
  // re-initialized on every call to connectYjsRoom, not just once when the
  // Awareness instance is created - React StrictMode's effect double-invoke
  // (mount -> cleanup -> mount again) runs this cleanup's setLocalState(null)
  // as part of that simulated unmount, which would otherwise wipe out a
  // one-time initialization done outside the effect before the "real" mount
  // ever settles.
  awareness.setLocalState({});

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
    } else if (messageType === MESSAGE_AWARENESS) {
      const update = decoding.readVarUint8Array(decoder);
      applyAwarenessUpdate(awareness, update, REMOTE_AWARENESS_ORIGIN);
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

  const onAwarenessUpdate = (
    { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ) => {
    if (origin === REMOTE_AWARENESS_ORIGIN) return;
    const changedClients = [...added, ...updated, ...removed];
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(encoder, encodeAwarenessUpdate(awareness, changedClients));
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(encoding.toUint8Array(encoder));
    }
  };
  awareness.on('update', onAwarenessUpdate);

  return () => {
    doc.off('update', onDocUpdate);
    awareness.off('update', onAwarenessUpdate);
    awareness.setLocalState(null);
    ws.close();
  };
}
