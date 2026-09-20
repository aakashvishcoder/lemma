import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/client';
import { isRoomMember } from '../services/roomService';

export async function requireDocumentRoomMembership(req: Request, res: Response, next: NextFunction) {
  const document = await prisma.document.findUnique({ where: { id: req.params.id as string } });
  if (!document) {
    return res.status(404).json({ error: 'Document not found' });
  }
  const member = await isRoomMember(req.userId!, document.roomId);
  if (!member) {
    return res.status(403).json({ error: "Not a member of this document's room" });
  }
  next();
}