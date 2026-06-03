import { Router, Response, Request } from "express";
import pool from "../db/connection";
// Import Middleware functions
import { requireAuth, AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/error";

const router = Router();

// router.use()

router.get('/public_key', asyncHandler(async (
    req: Request,
    res: Response
) => {
    const { email } = req.query as { email?: string };
    if(!email) {
        return res
            .status(400)
            .json({ error: "Email is Required"})
    }

    const [rows] = await pool.query(`
            SELECT username, public_key FROM users WHERE email = ?
        `, [email]
    );
    const user = (rows as any[])[0];
    if(!user) {
        return res
            .status(404)
            .json({ error: 'No Account Found for that Email'})
    }
}))

export default router;