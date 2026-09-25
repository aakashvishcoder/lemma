import { Router } from 'express';
import { z } from 'zod';
import { runRateLimit } from '../middleware/rateLimit';

export const runRouter = Router();

// Only languages the runner has installed (see scripts/install-runtimes.sh).
const RUNNABLE = ['python', 'javascript', 'typescript', 'cpp', 'java', 'go', 'rust', 'csharp', 'ruby', 'php'] as const;

const runSchema = z.object({
  language: z.enum(RUNNABLE),
  code: z.string().max(100_000),
});

const MAX_OUTPUT = 20_000;
const clip = (s: string) => (s.length > MAX_OUTPUT ? s.slice(0, MAX_OUTPUT) + '\n[output truncated]' : s);

runRouter.post('/', runRateLimit, async (req, res) => {
  const parsed = runSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Unsupported language or missing code' });
  }
  const runnerUrl = process.env.RUNNER_URL ?? 'http://localhost:2000';

  let upstream: Response;
  try {
    upstream = await fetch(`${runnerUrl}/api/v2/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: parsed.data.language,
        version: '*',
        files: [{ content: parsed.data.code }],
        compile_timeout: 10_000,
        run_timeout: 3_000,
        run_memory_limit: 256 * 1024 * 1024,
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return res.status(503).json({ error: 'The code runner is not available right now' });
  }

  const data = (await upstream.json().catch(() => null)) as {
    message?: string;
    compile?: { output: string; code: number };
    run?: { stdout: string; stderr: string; output: string; code: number | null; signal: string | null };
  } | null;
  if (!upstream.ok || !data?.run) {
    // Usually a runtime that has not been installed yet.
    return res.status(502).json({ error: data?.message ?? 'The code runner failed' });
  }

  const compileFailed = data.compile && data.compile.code !== 0;
  res.json({
    output: clip(compileFailed ? data.compile!.output : data.run.output),
    exitCode: compileFailed ? data.compile!.code : data.run.code,
    timedOut: data.run.signal === 'SIGKILL',
    compileError: Boolean(compileFailed),
  });
});
