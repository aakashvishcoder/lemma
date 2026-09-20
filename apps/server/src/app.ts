import express, { json } from 'express';
import cors from 'cors';
import { documentsRouter } from './routes/documents';
import { authRouter } from './routes/auth';

export const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/documents', documentsRouter);
app.get('/health', (req, res)=> res.json({status: 'ok'}));