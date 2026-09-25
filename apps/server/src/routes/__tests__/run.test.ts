import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../app';

const token = jwt.sign({ sub: 'run-test-user' }, process.env.JWT_SECRET!);
const post = (body: object) => request(app).post('/api/run').set('Authorization', `Bearer ${token}`).send(body);

describe('POST /api/run', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('requires a token', async () => {
    const res = await request(app).post('/api/run').send({ language: 'python', code: 'print(1)' });
    expect(res.status).toBe(401);
  });

  it('rejects languages the runner does not support', async () => {
    const res = await post({ language: 'brainfuck', code: '+' });
    expect(res.status).toBe(400);
  });

  it('returns the runner output', async () => {
    vi.stubGlobal('fetch', async () =>
      Response.json({ run: { stdout: 'hi\n', stderr: '', output: 'hi\n', code: 0, signal: null } }),
    );
    const res = await post({ language: 'python', code: 'print("hi")' });
    expect(res.body).toEqual({ output: 'hi\n', exitCode: 0, timedOut: false, compileError: false });
  });

  it('reports compile errors instead of run output', async () => {
    vi.stubGlobal('fetch', async () =>
      Response.json({
        compile: { output: 'error: expected ;', code: 1 },
        run: { stdout: '', stderr: '', output: '', code: null, signal: null },
      }),
    );
    const res = await post({ language: 'cpp', code: 'int main(' });
    expect(res.body.compileError).toBe(true);
    expect(res.body.output).toContain('expected');
  });

  it('returns 503 when the runner is down', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('ECONNREFUSED');
    });
    const res = await post({ language: 'python', code: 'print(1)' });
    expect(res.status).toBe(503);
  });
});
