import express from 'express';
import cors from 'cors';
import { documentsRouter } from './routes/documents';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/documents', documentsRouter);
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(3001, () => console.log('server listening on :3001'));