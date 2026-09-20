import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import * as Y from 'yjs';
import { app } from '../../app';
import { prisma } from '../../db/client';

describe('documents routes', () => {
  let documentId: string;
  let roomId: string;
  let userId: string;
  let token: string;

  beforeAll(async () => {
    const doc = new Y.Doc();
    doc.getText('content').insert(0, 'seeded content');
    const snapshot = Buffer.from(Y.encodeStateAsUpdate(doc));

    const room = await prisma.room.create({
      data: {
        name: 'Test Room',
        ownerId: 'test-user',
        inviteCode: `test-room-${Date.now()}`,
      },
    });
    roomId = room.id;

    const document = await prisma.document.create({
      data: { roomId: room.id, filename: 'test.ts', snapshot },
    });
    documentId = document.id;

    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: `test-${Date.now()}@example.com`,
        password: 'password123',
        displayName: 'Test User',
      });
    token = registerRes.body.token;
    userId = (jwt.decode(token) as { sub: string }).sub;
  });

  afterAll(async () => {
    await prisma.document.delete({ where: { id: documentId } });
    await prisma.room.delete({ where: { id: roomId } });
    await prisma.user.delete({ where: { id: userId } });
  });

  it('rejects requests with no Authorization header', async () => {
    const res = await request(app).get(`/api/documents/${documentId}`);
    expect(res.status).toBe(401);
  });

  it('GET /:id returns the document content', async () => {
    const res = await request(app)
      .get(`/api/documents/${documentId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ content: 'seeded content' });
  });

  it('POST /:id then GET /:id round-trips the new content', async () => {
    const postRes = await request(app)
      .post(`/api/documents/${documentId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'updated content' });
    expect(postRes.status).toBe(200);

    const getRes = await request(app)
      .get(`/api/documents/${documentId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.body).toEqual({ content: 'updated content' });
  });

  it('GET /:id for a nonexistent document does not return 200', async () => {
    const res = await request(app)
      .get('/api/documents/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).not.toBe(200);
  });
});
