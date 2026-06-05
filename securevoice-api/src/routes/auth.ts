import { Router, Request, Response } from "express";
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
// DB Imports
import pool from "../db/connection";
// Middleware Imports
import { requireAuth, AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/error";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET ?? '';

function signToken(payload: {
    id: string,
    email: string,
    username: string
}) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d'})    
}

/**
 * Post /api/auth/registration
 * 
 Client sends crypto material it generated locally:
 *   client_hash    — PBKDF2(password, GLOBAL_SALT, 50k) — never the raw password
 *   dek_salt       — random bytes the client will later use to derive KEK
 *   wrapped_dek    — AES-GCM(user_DEK, KEK) — opaque blob
 *   public_key     — RSA-OAEP public key (base64 SPKI or JWK string)
 *   private_key_enc — RSA private key encrypted with user_DEK
 *
 * Server generates auth_salt, stretches client_hash with Argon2id,
 * stores the result. The plaintext password and DEK never reach the server.
 */
router.post('/registration', asyncHandler( async (
    req: Request,
    res: Response
) => {
    const { 
        first_name, last_name, email, username, client_hash, dek_salt, wrapped_dek, public_key, private_key_enc
    } = req.body as Record <string, string>;
    
    // Check for field validations
    if(
        !email || !username || !client_hash || !dek_salt || !wrapped_dek || !public_key || !private_key_enc || !first_name || !last_name
    ) {
        return res
            .status(400)
            .json({ error: 'All Fields are Required for Registration'});
    }
    
    // Check for Uniqueness
    const [existing] = await pool.query(
        `SELECT id from users WHERE email = ? OR username = ? LIMIT 1`, [
            email, username
        ]
    );
    if((existing as any[])?.length > 0){
        return res
            .status(409)
            .json({ error: 'Email or Username already Exists'});
    }

    // Generate auth_salt for password rehashing
    const authSalt = crypto.randomBytes(32).toString('base64url');

    // Argon2 hashing with authSalt
    const rawHash = await argon2.hash(client_hash, {
        type: argon2.argon2id,
        salt: Buffer.from(authSalt, 'base64url'),
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
        raw: true
    })
    const passwordHash = rawHash.toString('base64url');

    // Insert Data into DB
    const id = uuidv4();
    await pool.query(`
        INSERT INTO users (id, email, first_name, last_name, username, password_hash, auth_salt, dek_salt, dek, public_key, private_key_enc)
        VALUES (?, ?, ?, ?, ?, ?, ?, ? ,? ,? ,?)
    `,[
        id, email, first_name, last_name, username, passwordHash, authSalt, dek_salt, wrapped_dek, public_key, private_key_enc
    ])
    
    // Generate Token for User authentication
    const token = signToken({ id, email, username })

    return res
        .status(201)
        .json({
            token,
            data: {
                id, email, username, dek_salt, dek: wrapped_dek, public_key, private_key_enc
            }
        });
}))

/**
 * POST /api/auth/login
 *
 * Client computes client_hash locally and sends it.
 * On success, the server returns dek_salt + wrapped_dek so the client can
 * derive KEK → unwrap user_DEK → decrypt notes — all in the browser.
 */

router.post('/login', asyncHandler( async (
    req: Request,
    res: Response
) => {
    const { email, client_hash } = req.body as Record <string, string>;

    if(!email || !client_hash) {
        return res
            .status(400)
            .json({ error: 'Email and Password are Required'})
    }

    // Extract User detail from DB table
    const [rows] = await pool.query(`
        SELECT id, email, username, password_hash, auth_salt, dek_salt, dek, public_key, private_key_enc FROM users WHERE email = ? LIMIT 1 
    `, [email],
    )
    const user = (rows as any[])[0];

    // Re-hash the incoming client_hash with the stored salt + same parameters
    const dummySalt = crypto.randomBytes(32);
    const recomputed = await argon2.hash(client_hash, {
        type: argon2.argon2id,
        salt: user ? Buffer.from(user.auth_salt, 'base64url') : dummySalt,
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
        raw: true
    });

    const storedHash  = Buffer.from(user?.password_hash ?? '', 'base64url');
    const isValidUser = user && crypto.timingSafeEqual(storedHash, recomputed);

    if(!isValidUser || !user) {
        return res
            .status(401)
            .json({ error: 'Invalid Credentials'})
    }

    // Generate Token for User authentication
    const token = signToken({ 
        id: user.id, 
        email: user.email,
        username: user.username,
    })

    return res.json({
        token,
        data: {
            id:  user.id,
            email: user.email,
            username:  user.email,
            dek_salt: user.dek_salt,
            dek: user.dek,
            public_key: user.public_key,
            private_key_enc: user.private_key_enc
        },
    });
}))

/**
 * GET /api/auth/me - returns the current user's profile
 */

router.get('/me', 
    requireAuth,
    asyncHandler( async(
        req: AuthRequest,
        res: Response
    ) => {
        const [rows] = await pool.query(`
            SELECT id, email, username, first_name, last_name, dek_salt, dek, public_key, private_key_enc, created_at FROM users WHERE id = ?
        `, [req.user!.id],
        )
        const user = (rows as any[])[0]
        if(!user) return res.status(404).json({ error: 'User Not Found'});
        return res.json({ user })
    })
)

export default router;