import { useEffect, useRef, useState } from 'react';
import Editor, { type Monaco, type OnMount } from '@monaco-editor/react';
import { MonacoBinding } from 'y-monaco';
import * as Y from 'yjs';
import type { Awareness } from 'y-protocols/awareness';
import { useCollabDoc } from './editor/useCollabDoc';
import { API_BASE } from './config';
import { Mark } from './ui/Mark';

const DEMO_INVITE_CODE = 'demo-room';
const LANGUAGES = [
  { id: 'typescript', label: 'TypeScript', ext: 'ts' },
  { id: 'javascript', label: 'JavaScript', ext: 'js' },
  { id: 'python', label: 'Python', ext: 'py' },
  { id: 'cpp', label: 'C++', ext: 'cpp' },
  { id: 'java', label: 'Java', ext: 'java' },
  { id: 'go', label: 'Go', ext: 'go' },
  { id: 'rust', label: 'Rust', ext: 'rs' },
  { id: 'csharp', label: 'C#', ext: 'cs' },
  { id: 'ruby', label: 'Ruby', ext: 'rb' },
  { id: 'php', label: 'PHP', ext: 'php' },
  { id: 'sql', label: 'SQL', ext: 'sql' },
  { id: 'html', label: 'HTML', ext: 'html' },
  { id: 'css', label: 'CSS', ext: 'css' },
  { id: 'json', label: 'JSON', ext: 'json' },
];
const RUNNABLE = new Set(['python', 'javascript', 'typescript', 'cpp', 'java', 'go', 'rust', 'csharp', 'ruby', 'php']);
const COLORS = ['#ff7a8a', '#4fdcf7', '#ffcb5c', '#62f0b8'];

interface Me {
  id: string;
  displayName: string;
}
interface Person {
  clientId: number;
  name: string;
  color: string;
  isMe: boolean;
}

function colorFor(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

function defineTheme(monaco: Monaco) {
  monaco.editor.defineTheme('lemma', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#0d1024',
      'editor.lineHighlightBackground': '#141a3f',
      'editorLineNumber.foreground': '#4b5390',
      'editorLineNumber.activeForeground': '#9299c8',
      'editorCursor.foreground': '#4fdcf7',
      'editor.selectionBackground': '#2b3163',
    },
  });
}

// Tracks who is in the room and injects one cursor style per remote person,
// since y-monaco tags each remote cursor with its client id.
function usePeople(awareness: Awareness, me: Me | null) {
  const [people, setPeople] = useState<Person[]>([]);

  useEffect(() => {
    if (!me) return;
    awareness.setLocalStateField('user', { name: me.displayName, color: colorFor(me.id) });

    const style = document.createElement('style');
    document.head.appendChild(style);

    const refresh = () => {
      const list: Person[] = [];
      let css = '';
      awareness.getStates().forEach((state, clientId) => {
        const user = state.user as { name: string; color: string } | undefined;
        if (!user) return;
        const isMe = clientId === awareness.clientID;
        list.push({ clientId, name: user.name, color: user.color, isMe });
        if (!isMe) {
          css += `.yRemoteSelection-${clientId}{background:${user.color}}
.yRemoteSelectionHead-${clientId}{color:${user.color}}
.yRemoteSelectionHead-${clientId}::after{content:${JSON.stringify(user.name)};background:${user.color}}\n`;
        }
      });
      style.textContent = css;
      setPeople(list);
    };

    awareness.on('change', refresh);
    refresh();
    return () => {
      awareness.off('change', refresh);
      style.remove();
    };
  }, [awareness, me]);

  return people;
}

// The language lives in a Y.Map on the same doc, so everyone in the room
// switches together and it rides the existing sync path.
function useSharedLanguage(doc: Y.Doc) {
  const [language, setLanguage] = useState('typescript');
  useEffect(() => {
    const meta = doc.getMap<string>('meta');
    const read = () => setLanguage(meta.get('language') ?? 'typescript');
    meta.observe(read);
    read();
    return () => meta.unobserve(read);
  }, [doc]);
  return language;
}

interface RunResult {
  output: string;
  exitCode: number | null;
  timedOut: boolean;
  compileError: boolean;
  failure?: string;
}

async function runCode(token: string, language: string, code: string): Promise<RunResult> {
  try {
    const res = await fetch(`${API_BASE}/api/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ language, code }),
    });
    const body = await res.json();
    if (!res.ok) return { output: '', exitCode: null, timedOut: false, compileError: false, failure: body.error ?? 'Run failed' };
    return body;
  } catch {
    return { output: '', exitCode: null, timedOut: false, compileError: false, failure: 'Could not reach the server' };
  }
}

function CollabEditor({ roomId, token, me, onSignOut }: { roomId: string; token: string; me: Me | null; onSignOut: () => void }) {
  const { doc, awareness } = useCollabDoc(roomId, token);
  const people = usePeople(awareness, me);
  const bindingRef = useRef<MonacoBinding | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  const language = useSharedLanguage(doc);
  const lang = LANGUAGES.find((l) => l.id === language) ?? LANGUAGES[0];

  const handleMount: OnMount = (editor) => {
    const model = editor.getModel();
    if (!model) return;
    bindingRef.current = new MonacoBinding(doc.getText('content'), model, new Set([editor]), awareness);
  };

  useEffect(() => {
    return () => bindingRef.current?.destroy();
  }, []);

  async function handleRun() {
    setRunning(true);
    setResult(await runCode(token, lang.id, doc.getText('content').toString()));
    setRunning(false);
  }

  return (
    <div className="editor-app">
      <header className="editor-bar">
        <div className="editor-brand">
          <Mark size={26} />
          Lemma
        </div>
        <span className="editor-file">demo-room / main.{lang.ext}</span>
        <select
          className="editor-lang"
          aria-label="Language"
          value={lang.id}
          onChange={(e) => doc.getMap('meta').set('language', e.target.value)}
        >
          {LANGUAGES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
        <span className="editor-live">
          <span>{people.length <= 1 ? 'Live, just you' : `Live, ${people.length} people`}</span>
        </span>
        <div className="editor-spacer" />
        <div className="editor-people">
          {people.map((p) => (
            <span
              key={p.clientId}
              className="editor-person"
              style={{ background: p.color }}
              title={p.isMe ? `${p.name} (you)` : p.name}
            >
              {p.name.charAt(0).toUpperCase()}
            </span>
          ))}
        </div>
        <button className="editor-run" onClick={handleRun} disabled={running || !RUNNABLE.has(lang.id)}>
          {running ? 'Running...' : RUNNABLE.has(lang.id) ? 'Run' : 'Not runnable'}
        </button>
        <button className="editor-signout" onClick={onSignOut}>
          Sign out
        </button>
      </header>
      <div className="editor-body">
        <Editor
          height="100%"
          theme="lemma"
          beforeMount={defineTheme}
          language={lang.id}
          onMount={handleMount}
          options={{
            fontFamily: "'JetBrains Mono', ui-monospace, Menlo, monospace",
            fontSize: 14,
            minimap: { enabled: false },
            padding: { top: 16 },
            smoothScrolling: true,
            cursorSmoothCaretAnimation: 'on',
            renderLineHighlight: 'gutter',
          }}
        />
      </div>
      {result && (
        <section className="editor-output" aria-label="Output">
          <div className="editor-output-head">
            <span>
              {result.failure
                ? 'Could not run'
                : result.compileError
                  ? 'Compile error'
                  : result.timedOut
                    ? 'Timed out after 3s'
                    : `Finished with exit code ${result.exitCode}`}
            </span>
            <button onClick={() => setResult(null)}>Close</button>
          </div>
          <pre>{result.failure ?? (result.output || '(no output)')}</pre>
        </section>
      )}
    </div>
  );
}

export default function EditorScreen({ token, onSignOut }: { token: string; onSignOut: () => void }) {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    const headers = { Authorization: `Bearer ${token}` };
    fetch(`${API_BASE}/api/rooms/join`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteCode: DEMO_INVITE_CODE }),
    })
      .then((res) => res.json())
      .then((room) => setRoomId(room.id));
    fetch(`${API_BASE}/api/auth/me`, { headers })
      .then((res) => res.json())
      .then(setMe);
  }, [token]);

  if (!roomId) {
    return <p className="editor-status">Joining the room...</p>;
  }

  return <CollabEditor roomId={roomId} token={token} me={me} onSignOut={onSignOut} />;
}
