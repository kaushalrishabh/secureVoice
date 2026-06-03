import { Request, Response, NextFunction } from "express";
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET ?? '';

export interface AuthRequest extends Request {
    user? : {
        id: string,
        email: string,
        username: string
    }
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction){
    const header = req.headers.authorization;

    if(!header?.startsWith("Bearer ")) {
        return res.status(401).json({
            error: "Unauthorized"
        })
    }

    const token = header.slice(7);
    try {
        const payload = jwt.verify(token, JWT_SECRET) as {
            id: string,
            email: string,
            username: string
        }
        req.user = payload;
        next();
    }
    catch {
        return res.status(401).json({
            error: "Invalid Token"
        })
    }
}