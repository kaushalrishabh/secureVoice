import { Request, Response, NextFunction } from "express";

export interface AppError extends Error {
    statusCode?: number
}

// To handle Error Status Code Message
export function errorHanlder(
    err: AppError,
    _req: Request,
    res: Response,
    _next: NextFunction
) {
    console.error(err)
    const status = err.statusCode ?? 500;
    const message = status < 500 ? err.message : "Internal Server Error"
    res.status(status).json({ error: message })
}

// Wraps an async route handler so unhandled rejections reach errorHandler
export function asyncHandler(
    fn: (req: Request, res: Response, next: NextFunction) => Promise <unknown>,
) {
    return ( req: Request, res: Response, next: NextFunction) => {
        fn(req, res, next).catch(next)
    }
}