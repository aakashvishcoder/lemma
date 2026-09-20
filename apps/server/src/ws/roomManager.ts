import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import type {WebSocket} from 'ws';

const MESSAGE_SYNC = 0;

interface Room {
    doc: Y.Doc,
    sockets: Set<WebSocket>,
}

const rooms = new Map<string, Room>();
function getRoom(roomId: string): Room {
    let room = rooms.get(roomId);
    if (room) return room;

    const doc = new Y.Doc();
    room = { doc, sockets: new Set()};
    rooms.set(roomId, room);

    doc.on('update', (update: Uint8Array, origin: WebSocket | null) => {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MESSAGE_SYNC);
        syncProtocol.writeUpdate(encoder, update);
        const message =encoding.toUint8Array(encoder);

        for(const ws of room!.sockets) {
            if(ws !== origin && ws.readyState=== ws.OPEN) {
                ws.send(message);
            }
        }
    });

    return room;
}

function send(ws: WebSocket, encoder: encoding.Encoder) {
    if(ws.readyState === ws.OPEN) {
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

    ws.on('message', (data: Buffer) => {
        const decoder = decoding.createDecoder(new Uint8Array(data));
        const messageType = decoding.readVarUint(decoder);

        if (messageType === MESSAGE_SYNC) {
            const reply = encoding.createEncoder();

            encoding.writeVarUint(reply, MESSAGE_SYNC);

            syncProtocol.readSyncMessage(decoder, reply, room.doc, ws);
            if (encoding.length(reply)> 1) {
                send(ws, reply);
            }
        }
    });

    ws.on('close', ()=> {
        room.sockets.delete(ws);
        if(room.sockets.size === 0) {
            rooms.delete(roomId);
        }
    });
}