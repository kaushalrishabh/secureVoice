import { Response, Router } from "express";
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import pool from "../db/connection";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/error";
import { getIO } from "../socket";
import { logActivity } from "../lib/activity";

const router = Router();

router.use(requireAuth);

/**
 * POST /api/notes/:nodeId/invite
 * 
 * Inviter (must be the note owner): sends a note_DEK already encrypted in their browser
 * using the invitee's RSA public key. The server stored this blob
 * without being able to read it - can be only decrypted by the invitee
 * 
 * Body: { invitee_email, enc_note_dek }
 */
router.post('/notes/:noteId/invite', asyncHandler( async(
    req: AuthRequest,
    res: Response
) => {
    const { noteId } = req.params;
    const { invitee_email, enc_note_dek } = req.body as {
        invitee_email: string,
        enc_note_dek: string
    }

    if(!invitee_email || !enc_note_dek) {
        return res.status(400).json({ error: "Invitee Email and Key are Required" })
    }

    // Inviter must own the note
    const [owner] = await pool.query(`
            SELECT n.id from notes n
            INNER JOIN note_keys nk ON nk.note_id = n.id
            WHERE n.id = ? AND nk.user_id = ? AND nk.role = 'owner'
            LIMIT 1    
        `, [noteId, req.user!.id]
    )

    if((owner as any[]).length === 0) {
        return res.status(403).json({ error: "Only Note Owner can send Invites"});
    }

    // Can't invite yourself
    if(invitee_email ===  req.user!.email) {
        return res.status(400).json({ error: "Can't Invite Yourself"})
    }

    // Invitee must have an account (Public key should be present)
    const [inviteeRows] = await pool.query(`
            SELECT id from users WHERE email = ? LIMIT 1    
        `, [invitee_email]
    )
    if((inviteeRows as any[]).length === 0) {
        return res.status(404).json({ error: "No Account Found for this Email "})
    }

    // Don't re-invite someone who already has an access
    const inviteeUserId = (inviteeRows as any[])[0].id
    const [already] = await pool.query(`
            SELECT note_id FROM note_keys WHERE note_id = ? and user_id = ? LIMIT 1
        `, [noteId, inviteeUserId]
    );
    if((already as any[]).length > 0) {
        return res.status(409).json({ error: "User Already has Access to this Note" });
    }

    // Expire any previous pending invitee for this note + invitee 
    await pool.query(`
            UPDATE invites SET status = 'expired'
            WHERE note_id = ? AND invitee_email = ? AND status = 'pending'   
        `,[noteId, invitee_email]
    );

    const id = uuidv4();
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 Days

    await pool.query(`
            INSERT INTO invites (id, note_id, inviter_id, invitee_email, token, enc_note_dek, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)
        `,[id, noteId, req.user!.id, invitee_email, token, enc_note_dek, expiresAt]
    );
    getIO().to(`user:${inviteeUserId}`).emit('invite:received', {
        inviteId: id,
        noteId,
        inviterUsername: req.user!.username,
        token,
        enc_note_dek,
        expires_at: expiresAt,
        created_at: new Date().toISOString()
    });
    // In Production: send an email with the invite link here
    return res.status(201).json({ 
        invite: {
            id, token, invitee_email, expiresAt:  expiresAt
        }
    })
}));
/**
 * GET /api/invites
 * Return all the pending invites addressed to the current user email
 * Includes the enc_note_dek blob so the client can decrypt it with their RSA Key
 */
router.get('/',  asyncHandler(async (
    req: AuthRequest,
    res: Response
) => {
    const [rows] = await pool.query(`
            SELECT 
                i.id, i.note_id, i.token, i.enc_note_dek, i.expires_at, i.created_at, u.username AS inviter_username
            FROM invites i
            INNER JOIN users u ON u.id  = i.inviter_id
            WHERE i.invitee_email = ?
                AND i.status = 'pending'
                AND i.expires_at > NOW()
            ORDER BY i.created_at DESC
        `,
        [req.user!.email]
    );
    return res.json({ invites: rows })
}))

/**
 * POST /api/invites/:token/accept
 * 
 * The invite has:
 *  1. RSA-decrypted enc_note_dek from the invite -> plaintext note_DEK (in browser)
 *  2. Re-wrapped note_DEK with their user_DEK -> new enc_note_dek (symmetric)
 * 
 * They POST the new enc_note_dek here. The server inserts a new note_keys row
 * and marks the invite accpeted - all in a transaction
 */
router.post('/:token/accept', asyncHandler(async (
    req: AuthRequest,
    res: Response
) => {
    const { enc_note_dek } = req.body as { enc_note_dek: string }

    if(!enc_note_dek) {
        return res.status(400).json({ error: "Key is Required "})
    }

    const [inviteRows] = await pool.query(`
            SELECT id, note_id, invitee_email, status, expires_at
            FROM invites
            WHERE token = ? 
            LIMIT 1    
        `,[req.params.token]
    );
    const invite = (inviteRows as any[])[0];
    
    if(!invite) {
        return res.status(404).json({ error: "Invite Not Found "});
    }
    if(invite.invitee_email !== req.user!.email) {
        return res.status(403).json({ error: "Invite is not for you"});
    }
    if(invite.status !== "pending") {
        return res.status(409).json({ error: `Invite is already ${invite.status}` });
    }
    if(new Date(invite.expires_at) < new Date()) {
        await pool.query(`
                UPDATE invites SET status = 'expired' WHERE id = ?    
            `,[invite.id]
        )
        return res.status(410).json({ error: 'Invite has Expired' });
    }

    const [existing] = await pool.query(
        `SELECT 1 FROM note_keys WHERE note_id = ? AND user_id = ? LIMIT 1`,
        [invite.note_id, req.user!.id],
    );
    if ((existing as any[]).length > 0) {
        return res.status(409).json({ error: 'You already have access to this note' });
    }
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // Insert symmetric key in the invite row
        await conn.query(`
                INSERT INTO note_keys (note_id, user_id, enc_note_dek, enc_method, role)
                VALUES (?, ?, ?, 'symmetric', 'editor')
            `, [invite.note_id, req.user!.id, enc_note_dek]
        );

        // Mark the Note as 'shared' if it isn't already
        await conn.query(`
                UPDATE notes SET type = 'shared' WHERE id = ?
            `, [invite.note_id]
        );

        await conn.query("UPDATE invites SET status = 'accepted' WHERE id = ? ", [invite.id]);
        await conn.commit();
        logActivity({ 
            noteId: invite.note_id,
            userId: req.user!.id,
            username: req.user!.username,
            event: 'collaborator_joined' 
        }).catch(() => {});
    }
    catch(err) {
        await conn.rollback();
        throw err
    }
    finally {
        conn.release()
    }
    getIO().to(`user:${invite.inviter_id}`).emit('invite:accepted', {
        noteId: invite.note_id,
        accepterUsername: req.user!.username,
    });
    return res.status(200).json({ message: "Invite Accepted", note_id: invite.note_id });
}))

/**
 * POST /api/invites/:token/decline
 *
 * Lets the invitee reject a pending invite. The inviter's enc_note_dek blob
 * is left untouched (it's useless without the invitee's RSA key anyway) —
 * we simply mark the invite as declined so it stops showing up as pending.
 */
// POST /:token/decline — add inviter_id and note_id to the select, then emit:
router.post(
    '/:token/decline',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const [inviteRows] = await pool.query(
            `SELECT id, invitee_email, status, inviter_id, note_id 
             FROM invites WHERE token = ? LIMIT 1`,
            [req.params.token],
        );
        const invite = (inviteRows as any[])[0];

        if (!invite) {
            return res.status(404).json({ error: 'Invite not found' });
        }
        if (invite.invitee_email !== req.user!.email) {
            return res.status(403).json({ error: 'This invite is not for you' });
        }
        if (invite.status !== 'pending') {
            return res.status(409).json({ error: `Invite is already ${invite.status}` });
        }
        await pool.query("UPDATE invites SET status = 'declined' WHERE id = ?", [invite.id]);

        // Notify the inviter in real time that their invite was declined
        getIO().to(`user:${invite.inviter_id}`).emit('invite:declined', {
            noteId: invite.note_id,
            declinerUsername: req.user!.username,
        });

        return res.json({ message: 'Invite declined' });
    }),
);

export default router;