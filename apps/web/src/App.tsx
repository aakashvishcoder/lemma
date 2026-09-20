import { useEffect, useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";

const DOCUMENT_ID = '9e8aa562-2744-44b1-bcbf-1b0379a28a24';
const API_BASE = "http://localhost:3001";

function App() {
  const [content, setContent] = useState('');
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/documents/${DOCUMENT_ID}`)
      .then((res) => res.json())
      .then((data) => setContent(data.content));
  }, []);

  const handleBlur = () => {
    const currentContent = editorRef.current?.getValue() ?? '';
    fetch(`${API_BASE}/api/documents/${DOCUMENT_ID}`, {
      method: "POST",
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: currentContent }),
    });
  };

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor;
    editor.onDidBlurEditorWidget(handleBlur);
  };

  return (
    <Editor
      height="100vh"
      defaultLanguage="typescript"
      value={content}
      onChange={(value) => setContent(value ?? '')}
      onMount={handleMount}
    />
  );
}

export default App;
