import { useEffect, useRef } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { MonacoBinding } from 'y-monaco';
import { useCollabDoc } from './editor/useCollabDoc';

const ROOM_ID = 'demo-room';

function App() {
  const doc = useCollabDoc(ROOM_ID);
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

export default App;