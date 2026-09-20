import * as Y from 'yjs';

import { prisma} from '../db/client';

export async function getContent(documentId: string) : Promise<string> {
    const document = await prisma.document.findUniqueOrThrow({
        where: {id : documentId}
    });
    const doc = new Y.Doc;
    Y.applyUpdate(doc, document.snapshot);

    return doc.getText('content').toString();
}

export async function saveContent(documentId: string, content: string): Promise<void> {
    const doc = new Y.Doc();
    doc.getText('content').insert(0, content);
    const snapshot = Buffer.from(Y.encodeStateAsUpdate(doc));
    await prisma.document.update({where: {id:documentId}, data: {snapshot}});
}