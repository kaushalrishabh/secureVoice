import { Server as IOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import pool from './db/connection';

interface AuthedSocket extends Socket {
    userId?: string;
}

let io: IOServer;

export function initializeSocket(httpServer: HTTPServer) {
    io = new IOServer(httpServer, {
        cors: {
            origin: process.env.CLIENT_URL ?? 'http://localhost:5173',
            credentials: true
        }
    });

    // Auth Middleware - same JWT used for REST APIs, passed via socket handshake
    io.use(( socket: AuthedSocket, next) => {
        const token = socket.handshake.auth?.token as string | undefined;
        if(!token) return next(new Error('No Token Provided'));

        try {
            const payload = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };
            socket.userId = payload.id;
            next();
        }
        catch{
            next(new Error('Invalid Token'));
        }
    })

    io.on('connection', (socket: AuthedSocket) => {
        const userId = socket.userId;
        socket.join(`user:${userId}`); // Personal Channel for invites

        socket.on('note:join', async(noteId: string) => {
            // Verify access before joining - same as REST access check
            const [rows] = await pool.query(`
                    SELECT 1 from note_keys WHERE note_id = ? AND user_id = ? LIMIT 1    
                `,[noteId, userId]
            );
            if((rows as any[]).length > 0) {
                socket.join(`note:${noteId}`)
            }
        });

        socket.on('note:leave', (noteId: string) => {
            socket.leave(`note: ${noteId}`);
        });

        socket.on('disconnect', () => {
            // Socket.IO auto leaves all rooms on disconnect
        });
    });
    return io;
}

export function getIO(): IOServer {
    if(!io) throw new Error('Socket not Initialized');
    return io;
}