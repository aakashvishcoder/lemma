import type { RunResult } from './run';

// JavaScript and Python run in a Web Worker in the visitor's own browser, so they
// work on the deployed site without a server-side sandbox. A worker has no access
// to the page, its cookies or localStorage, and is killed if it runs too long.
const TIME_LIMIT_MS = 3000;
const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js';

const JS_WORKER = `
self.onmessage = async (e) => {
  const { code, stdin } = e.data;
  self.postMessage({ type: 'started' });
  let out = '';
  const write = (s) => { if (out.length < 200000) out += s; };
  const show = (x) => { if (typeof x === 'string') return x; try { return JSON.stringify(x); } catch { return String(x); } };
  const log = (...a) => write(a.map(show).join(' ') + '\\n');
  const consoleShim = { log, info: log, warn: log, error: log, debug: log };
  const lines = stdin.split('\\n');
  if (lines[lines.length - 1] === '') lines.pop();
  let next = 0;
  const readline = () => (next < lines.length ? lines[next++] : undefined);
  const readers = [];
  const require = (name) => {
    if (name === 'fs') return { readFileSync: () => stdin, writeSync: (_fd, s) => write(String(s)) };
    if (name === 'readline') {
      return {
        createInterface: () => {
          const h = { line: [], close: [] };
          readers.push(h);
          const rl = {
            on: (ev, cb) => { (h[ev] = h[ev] || []).push(cb); return rl; },
            close: () => {},
            question: (q, cb) => { write(q); cb(readline() ?? ''); },
            [Symbol.asyncIterator]: async function* () { while (next < lines.length) yield lines[next++]; },
          };
          return rl;
        },
      };
    }
    throw new Error("require('" + name + "') is not available in the browser runner");
  };
  const process = { argv: [], env: {}, stdout: { write: (s) => write(String(s)) } };
  let exitCode = 0;
  try {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    await new AsyncFunction('require', 'process', 'console', 'readline', 'input', code)(require, process, consoleShim, readline, readline);
    for (const h of readers) {
      if (!h.line.length && !h.close.length) continue;
      while (next < lines.length) { const l = lines[next++]; h.line.forEach((cb) => cb(l)); }
      h.close.forEach((cb) => cb());
    }
  } catch (err) {
    exitCode = 1;
    write(String((err && err.stack) || err) + '\\n');
  }
  self.postMessage({ type: 'done', out, exitCode });
};
`;

const PY_WORKER = `
let pyodide;
self.onmessage = async (e) => {
  const { code, stdin } = e.data;
  const bytes = [];
  try {
    if (!pyodide) {
      importScripts('${PYODIDE}');
      pyodide = await loadPyodide();
    }
    self.postMessage({ type: 'started' });
    const lines = stdin.split('\\n');
    if (lines[lines.length - 1] === '') lines.pop();
    let next = 0;
    pyodide.setStdin({ stdin: () => (next < lines.length ? lines[next++] : undefined) });
    pyodide.setStdout({ raw: (c) => bytes.push(c) });
    pyodide.setStderr({ raw: (c) => bytes.push(c) });
    // Fresh globals each time so one run cannot see another's variables.
    await pyodide.runPythonAsync(code, { globals: pyodide.globals.get('dict')() });
    self.postMessage({ type: 'done', out: new TextDecoder().decode(new Uint8Array(bytes)), exitCode: 0 });
  } catch (err) {
    const out = new TextDecoder().decode(new Uint8Array(bytes));
    self.postMessage({ type: 'done', out: out + String((err && err.message) || err), exitCode: 1 });
  }
};
`;

const sources = { javascript: JS_WORKER, python: PY_WORKER };
type Kind = keyof typeof sources;

export const BROWSER_LANGUAGES = new Set<string>(Object.keys(sources));

const spawn = (kind: Kind) => new Worker(URL.createObjectURL(new Blob([sources[kind]], { type: 'text/javascript' })));

// Python is slow to load, so keep one worker and only replace it if it has to be killed.
let pythonWorker: Worker | null = null;
// Runs share that worker, so queue them rather than interleave.
let queue: Promise<unknown> = Promise.resolve();

function runOnce(kind: Kind, code: string, stdin: string): Promise<RunResult> {
  const worker = kind === 'python' ? (pythonWorker ??= spawn('python')) : spawn('javascript');
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout>;
    const kill = () => {
      worker.terminate();
      if (kind === 'python') pythonWorker = null;
    };
    const finish = (r: RunResult) => {
      clearTimeout(timer);
      worker.onmessage = null;
      worker.onerror = null;
      resolve(r);
    };
    // The clock starts when the program starts, not while Python is still loading.
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        kill();
        finish({ output: '', exitCode: null, timedOut: true, compileError: false });
      }, TIME_LIMIT_MS);
    };
    if (kind === 'javascript') arm();
    worker.onmessage = (e) => {
      if (e.data.type === 'started') return arm();
      if (kind === 'javascript') worker.terminate();
      finish({ output: e.data.out, exitCode: e.data.exitCode, timedOut: false, compileError: false });
    };
    worker.onerror = () => {
      kill();
      finish({ output: '', exitCode: null, timedOut: false, compileError: false, failure: 'The in-browser runner failed to start' });
    };
    worker.postMessage({ code, stdin });
  });
}

export function runInBrowser(kind: Kind, code: string, stdin: string): Promise<RunResult> {
  const result = queue.then(() => runOnce(kind, code, stdin));
  queue = result;
  return result;
}
