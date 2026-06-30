import { Response, Router } from "express";
import { v4 as uuidv4 } from 'uuid';
import { asyncHandler } from "../middleware/error";
import { requireAuth, AuthRequest } from "../middleware/auth";
import pool from "../db/connection";
import { getIO } from "../socket";

const router = Router();
router.use(requireAuth);

// ----------------------------------------------------------------
// Notes:
// ----------------------------------------------------------------

/**
 *  GET /api/notes
 *  Returns every note the current user has a key for (owned + shared)
 *  The encrypted content_cipher is included so the client can decrypt
 *  the title client-side for the list view
 *  Optional Query Param: ?folder_id = <id>
*/
router.get('/', asyncHandler(async (
    req: AuthRequest,
    res: Response
) => {
    const { folder_id } = req.query as { folder_id?: string }

    const params: unknown[] = [req.user!.id]
    let folderClause = '';
    if(folder_id) {
        folderClause = 'AND nk.folder_id = ?';
        params.push(folder_id)
    }

    const [rows] = await pool.query(`
        SELECT 
            n.id,
            n.content_cipher,
            n.content_iv,
            nk.pinned,
            nk.folder_id,
            n.updated_at,
            nk.role,
            nk.enc_note_dek,
        CASE 
            WHEN (SELECT COUNT(*) FROM note_keys WHERE note_id = n.id) > 1 
                THEN 'shared' 
                ELSE 'private' 
            END AS type
        FROM 
            notes n
        JOIN 
            note_keys nk ON nk.note_id = n.id AND nk.user_id = ? ${folderClause}
        ORDER BY 
            nk.pinned DESC,
            n.updated_at DESC
        `, params
    );
    return res.json({ notes: rows })
}));

/**
 * POST /api/notes
 * Creates a note and note_key in a single transaction
 * 
 * Body: 
 *  content_iv      - AES-GCM IV (base64)
 *  content_cipher  - AES-GCM ciphertext of { title, content } JSON (base64) 
 *  folder_id?      - UUID of an existing folder
 *  type?           - 'private' (default) | 'shared'
 *  pinned?         - boolean
 *  note_key: {
 *     enc_note_dek - note DEK wrapped by user_DEK
 *     enc_method   - 'symmetric' (always 'symmetric' for new private notes)
 *  }
*/
router.post('/', asyncHandler( async(
    req: AuthRequest,
    res: Response
) => {
    const {
        content_iv,
        content_cipher,
        folder_id = null,
        type = 'private',
        pinned = false,
        note_key
    } = req.body as {
        content_iv: string,
        content_cipher: string,
        folder_id?: string | null,
        type?: 'private' | 'shared',
        pinned?: boolean,
        note_key: {
            enc_note_dek: string,
            enc_method: 'symmetric' | 'asymmetric'
        }
    };

    if(!content_iv || !content_cipher) {
        return res.status(400).json({ error: "Error in Cipher Text "});
    }

    if(!note_key?.enc_note_dek || !note_key?.enc_method) {
        return res.status(400).json({ error: "Error in Encryption "});
    }

    if(!['private', 'shared'].includes(type)) {
        return res.status(400).json({ error: "Note type is Required" })
    }

    // Verify folder belongs to this user if provided
    if(folder_id) {
        const [folder] = await pool.query(`
                SELECT id FROM folders WHERE id = ? AND user_id = ? LIMIT 1
            `,[folder_id, req.user!.id]
        )
        if((folder as any[]).length === 0) {
            return res.status(400).json({ error: "Folder doesn't belong to you." })
        }
    }

    const conn = await pool.getConnection()
    try {
        await conn.beginTransaction();

        const noteId = uuidv4();
        await conn.query(`
                INSERT INTO notes (id, owner_id, type, content_iv, content_cipher)
                VALUES (?, ?, ?, ?, ?)
            `, [noteId, req.user!.id, type, content_iv, content_cipher]
        );

        await conn.query(`
                INSERT INTO note_keys (note_id, user_id, enc_note_dek, enc_method, role)
                VALUES (?, ?, ?, ?, 'owner')
            `, [noteId, req.user!.id, note_key.enc_note_dek, note_key.enc_method]
        );

        await conn.commit();
        const [rows] = await pool.query(`
                SELECT 
                    n.*,
                    nk.enc_note_dek,
                    nk.enc_method,
                    nk.role,
                    nk.folder_id,
                    nk.pinned
                FROM 
                    notes n
                INNER JOIN 
                    note_keys nk ON nk.note_id = n.id AND nk.user_id = ?
                WHERE 
                    n.id = ?
            `,[req.user!.id, noteId]
        )
        
        return res.status(201).json({ note: (rows as any[])[0] })
    }
    catch(err: any) {
        await conn.rollback();
        throw err
    }
    finally{
        conn.release();
    }
}));

/**
 * GET /api/notes/:id
 *  Returns the note, its key for the requesting user and all blocks
 *  Failed with 404 if the user has no key for this note. (Access Denied)
*/
router.get('/:id', asyncHandler( async(
    req: AuthRequest,
    res: Response
) => {
    const [noteRows] = await pool.query(`
        SELECT 
            n.*,
            nk.enc_note_dek,
            nk.enc_method,
            nk.role,
            nk.folder_id,
            nk.pinned
        FROM 
            notes n
        INNER JOIN 
            note_keys nk ON nk.note_id = n.id AND nk.user_id = ?
        WHERE 
            n.id = ?
        LIMIT 1
        `,[req.user!.id, req.params.id]
    );

    const note = (noteRows as any[])[0];
    if(!note) return res.status(404).json({ error: "Note Not Found" });

    const [blocks] = await pool.query(`
            SELECT id, author_id, content_iv, content_cipher, created_at
            FROM note_blocks
            WHERE note_id = ?
            ORDER BY created_at ASC
        `, [req.params.id]
    )

    return res.json({ note, blocks })
}));

/**
 * PUT /api/notes/:id
 * Updates the encypted content of a note. (only owner can do this)
 * Editors contribute via blocks (POST /notes/:id/blocks), not here.
 * 
 * Body: { content_iv, content_cipher, folder_id, pinned }
*/
router.put('/:id', asyncHandler(async (
    req: AuthRequest,
    res: Response
) => {

    const [accessRows] = await pool.query(
    `SELECT role FROM note_keys WHERE note_id = ? AND user_id = ? LIMIT 1`,
    [req.params.id, req.user!.id],
    );
    const access = (accessRows as any[])[0];
    if (!access) return res.status(403).json({ error: 'No access to this note' });

    // Anyone with access can pin/move to folder
    // (owner-only fields are title + content)

    const { content_iv, content_cipher, folder_id, pinned } = req.body as {
        content_iv?: string,
        content_cipher?: string,
        folder_id?: string | null,
        pinned?: boolean
    };

    const noteUpdates: string[] = [];
    const noteValues: unknown[] = [];
    const keyUpdates: string[] = [];
    const keyValues: unknown[] = [];
    
    // body params check
    if(content_iv !== undefined) { 
        noteUpdates.push('content_iv = ?');
        noteValues.push(content_iv);
    }
    if(content_cipher !== undefined) { 
        noteUpdates.push('content_cipher = ?');
        noteValues.push(content_cipher);
    }
    if(folder_id !== undefined) { 
        keyUpdates.push('folder_id = ?');
        keyValues.push(folder_id);
    }
    if(pinned !== undefined) { 
        keyUpdates.push('pinned = ?');
        keyValues.push(pinned ? 1 : 0);
    }
    
    if (noteUpdates.length === 0 && keyUpdates.length === 0) {
        return res.status(400).json({ error: 'No updatable fields provided' });
    }

    if (noteUpdates.length > 0) {
        noteValues.push(req.params.id);
        await pool.query(`UPDATE notes SET ${noteUpdates.join(', ')} WHERE id = ?`, noteValues);
    }
    if (keyUpdates.length > 0) {
        keyValues.push(req.params.id, req.user!.id);
        await pool.query(
            `UPDATE note_keys SET ${keyUpdates.join(', ')} WHERE note_id = ? AND user_id = ?`,
            keyValues,
        );
    }

    if (noteUpdates.length > 0) {
        getIO().to(`note:${req.params.id}`).emit('note:updated', {
            noteId: req.params.id,
            content_iv,
            content_cipher,
            updated_at: new Date().toISOString(),
        });
    }
    const [updated] = await pool.query(`
        SELECT n.*, nk.enc_note_dek, nk.enc_method, nk.role, nk.folder_id, nk.pinned
        FROM notes n
        INNER JOIN note_keys nk ON nk.note_id = n.id AND nk.user_id = ?
        WHERE n.id = ?
    `, [req.user!.id, req.params.id]);

    return res.json({ note: (updated as any[])[0] });
}))

/**
 * DELETE /api/notes/:id — owner only.
 * Cascades to note_keys, note_blocks, and invites via FK ON DELETE CASCADE.
*/
router.delete('/:id', asyncHandler( async(
    req: AuthRequest,
    res: Response
) => {
    const [rows] = await pool.query(`
            SELECT n.id FROM notes n
            INNER JOIN note_keys nk ON nk.note_id = n.id
            WHERE n.id = ? and nk.user_id = ? AND nk.role = 'owner'
            LIMIT 1
        `, [req.params.id, req.user!.id]
    );

    // check if note is deleted by its owner
    if((rows as any[]).length === 0) {
        return res.status(403).json({ error: "Only owner can delete a note" });
    }
    await pool.query(`
        DELETE FROM notes WHERE id = ? 
        `, [req.params.id]
    )
    return res.status(204).send();
}))

// ----------------------------------------------------------------
// Note Blocks
// ----------------------------------------------------------------

/**
 * POST /api/notes/:id/blocks
 * Appends an encrypted block. Any user with a note_key may add blocks.
 * Body: { content_iv, content_cipher }
 */
router.post('/:id/blocks', asyncHandler(async (req: AuthRequest, res: Response) => {
    const [access] = await pool.query(
        `SELECT 1 FROM note_keys WHERE note_id = ? AND user_id = ? LIMIT 1`,
        [req.params.id, req.user!.id],
    );
    if ((access as any[]).length === 0) {
        return res.status(403).json({ error: 'No access to this note' });
    }
    
    const { content_cipher, content_iv } = req.body as {
        content_cipher?: string;
        content_iv?: string;
    };
    if (!content_cipher || !content_iv) {
        return res.status(400).json({ error: 'content_iv and content_cipher are required' });
    }
    
    const id = uuidv4();
    await pool.query(
        `INSERT INTO note_blocks (id, note_id, author_id, content_iv, content_cipher)
        VALUES (?, ?, ?, ?, ?)`,
        [id, req.params.id, req.user!.id, content_iv, content_cipher],
    );
    
    const [rows] = await pool.query(
        `SELECT id, author_id, content_iv, content_cipher, created_at
        FROM note_blocks WHERE id = ?`,
        [id],
    );
    const payload = { 
        ...(rows as any[])[0], 
        author_username: req.user!.username
    }
    getIO().to(`note:${req.params.id}`).emit('block:new', { 
        noteId: req.params.id, 
        block: payload
    })
    
    return res.status(201).json({
        blocks: payload
    });
}));
 
/**
 * GET /api/notes/:id/blocks
 * Returns all blocks in chronological order with author usernames.
 */
router.get('/:id/blocks', asyncHandler(async (req: AuthRequest, res: Response) => {
    const [access] = await pool.query(
        `SELECT 1 FROM note_keys WHERE note_id = ? AND user_id = ? LIMIT 1`,
        [req.params.id, req.user!.id],
    );
    if ((access as any[]).length === 0) {
        return res.status(403).json({ error: 'No access to this note' });
    }
    
    const [blocks] = await pool.query(
        `SELECT
        nb.id,
        nb.author_id,
        nb.content_iv,
        nb.content_cipher,
        nb.created_at,
        u.username AS author_username
        FROM note_blocks nb
        JOIN users u ON u.id = nb.author_id
        WHERE nb.note_id = ?
        ORDER BY nb.created_at ASC`,
        [req.params.id],
    );
    
    return res.json({ blocks });
}));
 
/**
 * PUT /api/notes/:id/blocks/:blockId
 * Lets the original author edit their own block.
 * Body: { content_iv, content_cipher }
 */
router.put('/:id/blocks/:blockId', asyncHandler(async (req: AuthRequest, res: Response) => {
    const { content_iv, content_cipher } = req.body as {
        content_iv?: string;
        content_cipher?: string;
    };
    if (!content_iv || !content_cipher) {
        return res.status(400).json({ error: 'content_iv and content_cipher are required' });
    }
    
    const [rows] = await pool.query(
        `SELECT id, author_id FROM note_blocks WHERE id = ? AND note_id = ? LIMIT 1`,
        [req.params.blockId, req.params.id],
    );
    const block = (rows as any[])[0];
    
    if (!block) {
        return res.status(404).json({ error: 'Block not found' });
    }
    if (block.author_id !== req.user!.id) {
        return res.status(403).json({ error: 'You can only edit your own contributions' });
    }
    
    await pool.query(
        `UPDATE note_blocks SET content_iv = ?, content_cipher = ? WHERE id = ?`,
        [content_iv, content_cipher, block.id],
    );

    getIO().to(`note:${req.params.id}`).emit('block:updated', {
        noteId: req.params.id,
        blockId: block.id,
        content_iv,
        content_cipher,
    });

    return res.json({ message: 'Block updated' });
}));

/**
 * DELETE /api/notes/:id/blocks/:blockId
 * Lets the author + shared owner delete their own block.
 * Body: { content_iv, content_cipher }
 */

router.delete('/:id/blocks/:blockId', asyncHandler(async (req: AuthRequest, res: Response) => {
  // Check note access + role
    const [accessRows] = await pool.query(
        `SELECT role FROM note_keys WHERE note_id = ? AND user_id = ? LIMIT 1`,
        [req.params.id, req.user!.id],
    );
    const access = (accessRows as any[])[0];
    if (!access) return res.status(403).json({ error: 'No access to this note' });

    const [rows] = await pool.query(
        `SELECT id, author_id FROM note_blocks WHERE id = ? AND note_id = ? LIMIT 1`,
        [req.params.blockId, req.params.id],
    );
    const block = (rows as any[])[0];
    if (!block) return res.status(404).json({ error: 'Block not found' });

    // Owner can delete any block — editors only their own
    if (access.role !== 'owner' && block.author_id !== req.user!.id) {
        return res.status(403).json({ error: 'You can only delete your own contributions' });
    }

    await pool.query(`DELETE FROM note_blocks WHERE id = ?`, [block.id]);
    getIO().to(`note:${req.params.id}`).emit('block:deleted', {
        noteId: req.params.id,
        blockId: block.id,
    });
    return res.status(204).send();

}));

export default router;