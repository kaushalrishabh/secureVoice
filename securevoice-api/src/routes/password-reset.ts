/**
 * password-reset.ts
 *
 * Recovery architecture:
 *   - dek_escrow = RSA-OAEP(user_DEK, SERVER_PUBLIC_KEY) — stored at registration
 *   - On reset: server decrypts escrow → returns raw user_DEK bytes to client
 *   - Client re-wraps user_DEK with new KEK (derived from new password)
 *   - ONLY password_hash, auth_salt, dek_salt, dek change — everything else is intact:
 *       public_key, private_key_enc, dek_escrow, and ALL note_keys remain valid
 */

import { Router, Request, Response } from 'express';
import argon2    from 'argon2';
import crypto    from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import nodemailer from 'nodemailer';
import pool from '../db/connection';
import { asyncHandler } from '../middleware/error';

const router = Router();

// ── Email ─────────────────────────────────────────────────────────────────────

async function sendResetEmail(to: string, resetUrl: string): Promise<void> {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  await transporter.sendMail({
    from: `"SecureVoice" <${process.env.SMTP_USER}>`,
    to,
    subject: 'Reset your SecureVoice password',
    html: `
      <!DOCTYPE html>
      <html>
        <body style="margin:0;padding:0;background:#0C0C0E;font-family:sans-serif;">
          <div style="max-width:480px;margin:40px auto;padding:40px 32px;
                      background:#18181B;border-radius:16px;border:0.5px solid rgba(255,255,255,0.08);">
            <div style="width:40px;height:40px;background:#F59E0B;border-radius:10px;
                        display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;">
              <span style="color:#0C0C0E;font-size:20px;">🎙</span>
            </div>
            <h2 style="color:#FAFAFA;font-size:20px;font-weight:500;margin:0 0 8px;">Reset your password</h2>
            <p style="color:#71717A;font-size:14px;line-height:1.6;margin:0 0 24px;">
              Click the button below to reset your password. Your encrypted notes will remain safe —
              only your password changes, not your encryption keys. Link expires in <strong style="color:#FAFAFA;">1 hour</strong>.
            </p>
            <a href="${resetUrl}"
               style="display:inline-block;background:#F59E0B;color:#0C0C0E;padding:14px 28px;
                      border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;margin-bottom:24px;">
              Reset Password →
            </a>
            <p style="color:#3F3F46;font-size:12px;margin:0;">
              If you didn't request this, you can safely ignore this email.
            </p>
          </div>
        </body>
      </html>
    `,
  });
}

// ── POST /api/auth/forgot-password ────────────────────────────────────────────

router.post('/forgot-password', asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body as { email: string };
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const [rows] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    const user = (rows as any[])[0];

    if (user) {
        // Invalidate existing pending tokens
        await pool.query(
        "UPDATE password_resets SET used = 1 WHERE user_id = ? AND used = 0",
        [user.id],
        );

        const token     = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        await pool.query(
        'INSERT INTO password_resets (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
        [uuidv4(), user.id, token, expiresAt],
        );

        const resetUrl = `${process.env.CLIENT_URL ?? 'http://localhost:5173'}/reset-password?token=${token}`;
        await sendResetEmail(email, resetUrl);
    }

    // Always return success — prevents email enumeration
    return res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
}));

// ── GET /api/auth/validate-reset-token ───────────────────────────────────────

router.get('/validate-reset-token', asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.query as { token?: string };
    if (!token) return res.status(400).json({ error: 'Token is required' });

    const [rows] = await pool.query(
        `SELECT id FROM password_resets
        WHERE token = ? AND used = 0 AND expires_at > NOW() LIMIT 1`,
        [token],
    );

    if ((rows as any[]).length === 0) {
        return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
    }

    return res.json({ valid: true });
}));

// ── GET /api/auth/recover-dek ─────────────────────────────────────────────────
// Decrypts dek_escrow using server RSA private key.
// Returns raw user_DEK bytes so client can re-wrap with new KEK.

router.get('/recover-dek', asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.query as { token?: string };
    if (!token) return res.status(400).json({ error: 'Token is required' });

    // Validate token and fetch dek_escrow
    const [rows] = await pool.query(
        `SELECT pr.id, u.dek_escrow
        FROM password_resets pr
        JOIN users u ON u.id = pr.user_id
        WHERE pr.token = ? AND pr.used = 0 AND pr.expires_at > NOW()
        LIMIT 1`,
        [token],
    );
    const reset = (rows as any[])[0];
    if (!reset) return res.status(400).json({ error: 'Invalid or expired reset link' });

    if (!reset.dek_escrow) {
        return res.status(400).json({ error: 'This account does not have recovery enabled.' });
    }

    if (!process.env.RECOVERY_PRIVATE_KEY) {
        return res.status(500).json({ error: 'Recovery is not configured on this server.' });
    }

    // Decrypt the escrow with the server RSA private key
    const privateKeyPem = process.env.RECOVERY_PRIVATE_KEY.replace(/\\n/g, '\n');
    const dekBytes = crypto.privateDecrypt(
        {
        key:        privateKeyPem,
        padding:    crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash:   'sha256',
        },
        Buffer.from(reset.dek_escrow, 'base64url'),
    );

    return res.json({ user_dek: dekBytes.toString('base64url') });
}));

// ── POST /api/auth/reset-password ─────────────────────────────────────────────
// Only updates password-related fields.
// public_key, private_key_enc, dek_escrow, and all note_keys stay unchanged.

router.post('/reset-password', asyncHandler(async (req: Request, res: Response) => {
    const { token, client_hash, dek_salt, dek } = req.body as Record<string, string>;

    if (!token || !client_hash || !dek_salt || !dek) {
        return res.status(400).json({ error: 'token, client_hash, dek_salt and dek are required' });
    }

    const [rows] = await pool.query(
        `SELECT pr.id, pr.user_id FROM password_resets pr
        WHERE pr.token = ? AND pr.used = 0 AND pr.expires_at > NOW()
        LIMIT 1`,
        [token],
    );
    const reset = (rows as any[])[0];
    if (!reset) return res.status(400).json({ error: 'Invalid or expired reset link' });

    // Hash the new client_hash with a fresh auth_salt
    const auth_salt = crypto.randomBytes(32).toString('base64url');
    const rawHash   = await argon2.hash(client_hash.replace(/=+$/, ''), {
        type:        argon2.argon2id,
        salt:        Buffer.from(auth_salt, 'base64url'),
        memoryCost:  19456,
        timeCost:    2,
        parallelism: 1,
        raw:         true,
    });
    const password_hash = (rawHash as Buffer).toString('base64url');

    // Update ONLY password + DEK wrapper fields
    await pool.query(
        `UPDATE users
        SET password_hash = ?,
            auth_salt     = ?,
            dek_salt      = ?,
            dek           = ?
        WHERE id = ?`,
        [password_hash, auth_salt, dek_salt, dek, reset.user_id],
    );

    await pool.query('UPDATE password_resets SET used = 1 WHERE id = ?', [reset.id]);

    return res.json({ message: 'Password reset successfully. Please sign in with your new password.' });
}));

export default router;