import { useEffect, useState } from 'react';
import * as Y from 'yjs';
import { runCode, sameOutput, RUNNABLE } from './editor/run';

interface TestCase {
  id: string;
  input: string;
  expected: string;
}
type Verdict = { state: 'running' } | { state: 'pass' } | { state: 'fail'; actual: string } | { state: 'error'; message: string };

// Test cases live in the shared doc, so the whole room sees the same set.
function useSharedTests(doc: Y.Doc) {
  const array = doc.getArray<TestCase>('tests');
  const [tests, setTests] = useState<TestCase[]>(() => array.toArray());
  useEffect(() => {
    const read = () => setTests(array.toArray());
    array.observe(read);
    read();
    return () => array.unobserve(read);
  }, [array]);
  return { tests, array };
}

// Keeps what you are typing locally and saves to the shared doc when you leave the
// field, so remote edits never yank the text out from under your cursor mid-word.
function CommitTextarea({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <textarea
      spellCheck={false}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => local !== value && onCommit(local)}
    />
  );
}

export function TestsPanel({
  doc,
  token,
  language,
  onClose,
}: {
  doc: Y.Doc;
  token: string;
  language: string;
  onClose: () => void;
}) {
  const { tests, array } = useSharedTests(doc);
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});
  const [running, setRunning] = useState(false);
  const canRun = RUNNABLE.has(language);

  function update(index: number, patch: Partial<TestCase>) {
    const next = { ...array.get(index), ...patch };
    doc.transact(() => {
      array.delete(index, 1);
      array.insert(index, [next]);
    });
  }

  async function runAll() {
    setRunning(true);
    setVerdicts({});
    const code = doc.getText('content').toString();
    for (const t of array.toArray()) {
      setVerdicts((v) => ({ ...v, [t.id]: { state: 'running' } }));
      const r = await runCode(token, language, code, t.input);
      const verdict: Verdict = r.failure
        ? { state: 'error', message: r.failure }
        : r.compileError
          ? { state: 'error', message: `Compile error\n${r.output}` }
          : r.timedOut
            ? { state: 'error', message: 'Time limit exceeded (3s)' }
            : r.exitCode
              ? { state: 'error', message: `Runtime error (exit code ${r.exitCode})\n${r.output}` }
              : sameOutput(r.output, t.expected)
                ? { state: 'pass' }
                : { state: 'fail', actual: r.output };
      setVerdicts((v) => ({ ...v, [t.id]: verdict }));
      if (r.failure) break; // the runner itself is down, no point trying the rest
    }
    setRunning(false);
  }

  const passed = tests.filter((t) => verdicts[t.id]?.state === 'pass').length;
  const ran = tests.filter((t) => verdicts[t.id] && verdicts[t.id].state !== 'running').length;

  return (
    <section className="editor-output tests" aria-label="Test cases">
      <div className="editor-output-head">
        <span>{ran > 0 ? `${passed} of ${tests.length} passed` : `${tests.length} test case${tests.length === 1 ? '' : 's'}`}</span>
        <span className="tests-actions">
          <button onClick={() => array.push([{ id: crypto.randomUUID(), input: '', expected: '' }])}>Add case</button>
          <button className="tests-run" onClick={runAll} disabled={running || !canRun || tests.length === 0}>
            {running ? 'Running...' : 'Run all'}
          </button>
          <button onClick={onClose}>Close</button>
        </span>
      </div>
      <div className="tests-list">
        {tests.length === 0 && (
          <p className="tests-empty">
            Add a case. The input is fed to your program as stdin, and its output is compared with the expected output.
          </p>
        )}
        {tests.map((t, i) => {
          const v = verdicts[t.id];
          return (
            <div className="test-case" key={t.id}>
              <div className="test-head">
                <strong>Case {i + 1}</strong>
                <span className={`verdict verdict-${v?.state ?? 'idle'}`}>
                  {!v ? '' : v.state === 'running' ? 'Running' : v.state === 'pass' ? 'Passed' : v.state === 'fail' ? 'Wrong answer' : 'Error'}
                </span>
                <button onClick={() => array.delete(i, 1)} aria-label={`Delete case ${i + 1}`}>
                  Remove
                </button>
              </div>
              <div className="test-io">
                <label>
                  Input
                  <CommitTextarea value={t.input} onCommit={(input) => update(i, { input })} />
                </label>
                <label>
                  Expected output
                  <CommitTextarea value={t.expected} onCommit={(expected) => update(i, { expected })} />
                </label>
              </div>
              {v?.state === 'fail' && (
                <pre className="test-got">
                  Your output:{'\n'}
                  {v.actual || '(no output)'}
                </pre>
              )}
              {v?.state === 'error' && <pre className="test-got">{v.message}</pre>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
