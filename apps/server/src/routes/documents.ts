import { Router } from "express";
import { getContent, saveContent } from "../services/documentService";
import { requireDocumentRoomMembership } from "../middleware/requireRoomMembership";

export const documentsRouter = Router();

documentsRouter.use('/:id', requireDocumentRoomMembership);
documentsRouter.get('/:id', async (req, res) => {
    const content = await getContent(req.params.id);
    res.json({ content});
})

documentsRouter.post('/:id', async (req,res)=> {
    await saveContent(req.params.id, req.body.content);
    res.json({ ok: true});
});

