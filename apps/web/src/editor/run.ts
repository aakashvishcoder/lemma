import { API_BASE } from '../config';
import { BROWSER_LANGUAGES, runInBrowser } from './browserRun';

export const RUNNABLE = new Set(['python', 'javascript', 'typescript', 'cpp', 'java', 'go', 'rust', 'csharp', 'ruby', 'php']);

export interface RunResult {
  output: string;
  exitCode: number | null;
  timedOut: boolean;
  compileError: boolean;
  failure?: string;
}

const failed = (failure: string): RunResult => ({ output: '', exitCode: null, timedOut: false, compileError: false, failure });

export async function runCode(token: string, language: string, code: string, stdin = ''): Promise<RunResult> {
  if (BROWSER_LANGUAGES.has(language)) return runInBrowser(language as 'javascript' | 'python', code, stdin);
  try {
    const res = await fetch(`${API_BASE}/api/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ language, code, stdin }),
    });
    const body = await res.json();
    return res.ok ? body : failed(`${body.error ?? 'Run failed'}. JavaScript and Python run in your browser instead.`);
  } catch {
    return failed('Could not reach the server');
  }
}

// Like most judges, ignore trailing spaces on each line and blank lines at the end.
const normalize = (s: string) =>
  s
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trimEnd();

export const sameOutput = (actual: string, expected: string) => normalize(actual) === normalize(expected);
