import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function connectSocket(token: string): Socket {
    if(socket && (socket?.connected || socket?.active) ) return socket;

    socket = io(import.meta.env.VITE_API_URL ?? "http://localhost:3000", {
        auth: { token },
        autoConnect: true,
    });
    
    return socket;
}

export function getSocket(): Socket | null {
    return socket;
}

export function disconnectSocket(): void {
    socket?.disconnect();
    socket = null;
}