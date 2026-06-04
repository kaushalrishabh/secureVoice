import { Response, Router } from "express";
import { v4 as uuidv4 } from 'uuid';
import { asyncHandler } from "../middleware/error";
import { requireAuth, AuthRequest } from "../middleware/auth";
import pool from "../db/connection";

const router = Router();
router.use(requireAuth);

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
        folderClause = 'AND n.folder_id = ?';
        params.push(folder_id)
    }

    const [rows] = await pool.query(`
            SELECT 
                n.id, n.owner_id, n.folder_id, n.type, n.content_iv, n.content_cipher, n.pinned, n.created_at, n.updated_at,
                nk.enc_note_dek, nk.enc_method, nk.role
            FROM notes n
            INNER JOIN note_keys nk ON nk.note_id = n.id AND nk.user_id = ?
            ${folderClause}
            ORDER BY n.pinned DESC, n.updated_at DESC,    
        `, params,
    )
    return res.json({ notes: rows })
}));

/**
 * GET /api/notes/:id/blocks
 * Return all blocks for a note in chronological order
*/
router.get('/:id/blocks', asyncHandler( async(
    req: AuthRequest,
    res: Response
) => {
    const [access] = await pool.query(`
            SELECT role FROM note_keys WHERE note_id = ? AND user_id = ? LIMIT 1
        `, [req.params.id, req.user!.id]
    )
    if((access as any[])[0].length === 0){
        return res.status(403).json({ error: 'You do not have access to view this note '})
    }

    const [blocks] = await pool.query(`
            SELECT id, author_id, content_iv, content_cipher, created_at
            FROM note_blocks
            WHERE note_id = ?
            ORDER BY created_at ASC
        `, [req.params.id]
    );

    return res.json({ blocks })
}))


export default router;