import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './db/connection';
import { errorHandler } from './middleware/error';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import folderRoutes from './routes/folder';
import inviteRoutes from './routes/invites';
import notesRoutes from './routes/notes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: process.env.CLIENT_URL ?? "http://localhost:5173", 
  credentials: true
}));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes)
app.use('/app/folders', folderRoutes)
app.use('/app/invites', inviteRoutes)
app.use('/app/notes', notesRoutes)

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use(errorHandler);

app.listen(PORT, async () => {
  try {
    await connectDB();
    console.log(`Server Running on Port ${PORT}`)
  }
  catch(err : any) {
    console.error("Database Connection Failed. ",err.message)
  }
})