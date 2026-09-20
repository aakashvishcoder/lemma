import { useEffect, useRef, useState } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { MonacoBinding } from 'y-monaco';
import { useCollabDoc } from './editor/useCollabDoc';
import { useAuth } from './auth/AuthContext';
import { AuthScreen } from './auth/AuthScreen';

const DEMO_INVITE_CODE = 'demo-room';
const API_BASE = 'http://localhost:3001';

function CollabEditor({ roomId, token }: { roomId: string; token: string }) {
  const doc = useCollabDoc(roomId, token);
  const bindingRef = useRef<MonacoBinding | null>(null);

  const handleMount: OnMount = (editor) => {
    const model = editor.getModel();
    if (!model) return;
    bindingRef.current = new MonacoBinding(doc.getText('content'), model, new Set([editor]));
  };

  useEffect(() => {
    return () => bindingRef.current?.destroy();
  }, []);

  return <Editor height="100vh" defaultLanguage="typescript" onMount={handleMount} />;
}

function EditorScreen({ token }: { token: string }) {
  const [roomId, setRoomId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/rooms/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ inviteCode: DEMO_INVITE_CODE }),
    })
      .then((res) => res.json())
      .then((room) => setRoomId(room.id));
  }, [token]);

  if (!roomId) {
    return <p>Joining room...</p>;
  }

  return <CollabEditor roomId={roomId} token={token} />;
}

function App() {
  const { token, logout } = useAuth();

  if (!token) {
    return <AuthScreen />;
  }

  return (
    <div style={{ height: '100vh' }}>
      <button onClick={logout} style={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}>
        Log out
      </button>
      <EditorScreen token={token} />
    </div>
  );
}

export default App;
