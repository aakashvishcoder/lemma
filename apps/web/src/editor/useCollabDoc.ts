import { useEffect, useRef } from 'react';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { connectYjsRoom } from './yjsProvider';

export function useCollabDoc(roomId: string, token: string): { doc: Y.Doc; awareness: Awareness } {
  const docRef = useRef<Y.Doc | undefined>(undefined);
  const awarenessRef = useRef<Awareness | undefined>(undefined);
  if (!docRef.current) {
    docRef.current = new Y.Doc();
  }
  if (!awarenessRef.current) {
    awarenessRef.current = new Awareness(docRef.current);
  }

  useEffect(() => {
    return connectYjsRoom(roomId, token, docRef.current!, awarenessRef.current!);
  }, [roomId, token]);

  return { doc: docRef.current, awareness: awarenessRef.current };
}
