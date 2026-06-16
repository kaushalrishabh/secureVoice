import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/error';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import folderRoutes from './routes/folder';
import inviteRoutes from './routes/invites';
import notesRoutes from './routes/notes';
import passwordResetRoutes from './routes/password-reset';

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL ?? "http://localhost:5173", 
  credentials: true
}));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

// Public auth routes - no middleware
app.use('/api/auth', authRoutes);
app.use('/api/auth', passwordResetRoutes)

// Private routes - guarded by middleware
app.use('/api/users', userRoutes)
app.use('/api/folders', folderRoutes)
app.use('/api/invites', inviteRoutes)
app.use('/api', inviteRoutes)
app.use('/api/notes', notesRoutes)
app.use(errorHandler);

export default app;