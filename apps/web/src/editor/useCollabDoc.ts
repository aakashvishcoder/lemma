import { useEffect, useRef } from 'react';
import * as Y from 'yjs';
import { connectYjsRoom } from './yjsProvider';
export function useCollabDoc(roomId: string, token: string): Y.Doc {
  const docRef = useRef<Y.Doc | undefined>(undefined);
  if (!docRef.current) {
    docRef.current = new Y.Doc();
  }

  useEffect(() => {
    return connectYjsRoom(roomId, token, docRef.current!);
  }, [roomId, token]);

  return docRef.current;
}