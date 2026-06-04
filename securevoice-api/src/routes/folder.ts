import { Response, Router } from "express";
import { v4 as uuidv4 } from 'uuid';
import pool from "../db/connection";

import { requireAuth, AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/error";

const router = Router();

router.use(requireAuth);

// Get /api/folders - list of all folders belonging to a user
router.get('/', asyncHandler(async (
    req: AuthRequest,
    res: Response
) => {
    const [rows] = await pool.query(`
            SELECT id, name, color, created_at
            FROM folders
            WHERE user.id = ?
            ORDER BY created_at ASC
        `, [req.user!.id]
    );
    return res.json({ folders: rows })
}))

// Post /api/folders - Create a New Folder
router.post('/', asyncHandler(async (
    req: AuthRequest,
    res: Response
) => {
    const { name, color } = req.body as { name?: string; color?: string};
    
    if(!name || name.trim().length === 0) {
        return res.status(400).json({ error: "Folder Name is Required" })
    }

    if(name.trim().length > 100) {
        return res.status(400).json({ error: "Folder Name Must be 100 characters of fewer" });
    }

    if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return res.status(400).json({ error: 'color must be a valid hex value e.g. #4F46E5' });
    }

    const id = uuidv4();
    await pool.query(`
            INSERT INTO folders (id, user_id, name, color ) VALUES (? ,? ,? ,?)
        `,[id, req.user!.id, name.trim(), color ?? "#4F46E5"]
    );

    const [rows] = await pool.query(`
            SELECT id, name, color, created_at FROM folders WHERE id = ?
        `,[id]
    )

    return res.status(201).json({ folder: (rows as any[])[0]})

}))


// PUT /api/folders/:id - Rename or Recolor a Folder
router.put('/:id' , asyncHandler(async(
    req: AuthRequest,
    res: Response
) => {
    const { name, color } = req.body as { name?: string; color?: string};

    // Validation checks
    if(!name && !color){
        res.status(400).json({ error: "Provide at least one of name or color "});
    }
    if(name !== undefined && name.trim().length == 0) {
        res.status(400).json({ error: "Folder Name cannot be Empty"});
    }
    if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return res.status(400).json({ error: 'color must be a valid hex value e.g. #4F46E5' });
    }

    // Ownership Check
    const [existing] = await pool.query(`
            SELECT id FROM folders WHERE id = ? AND user_id = ?
        `,[req.params.id, req.user!.id]
    );
    if((existing as any[]).length > 0){
        return res.status(401).json({ error: "Folder Not Found"})
    }

    // Build Set clause dynamically based on what was provided
    const updates: string[] = [];
    const values: unknown[] = [];
    if(name !== undefined){
        updates.push('name = ?')
        values.push(name.trim());
    } 
    if(color !== undefined){
        updates.push('color = ?')
        values.push(color.trim());
    }
    values.push(req.params.id)

    await pool.query(`
            UPDATE folders SET ${updates.join(', ')} WHERE id = ?
        `, values
    )

    const [rows] = await pool.query(`
            SELECT id, name, color, created_at FROM folders WHERE id = ?
        `,[req.params.id]
    )

    return res.json({ folder: (rows as any[])[0] });
}));

// DELETE /api/folders/:id - notes in the folder are kept but folder is deleted
router.delete('/:id', asyncHandler(async (
    req: AuthRequest,
    res: Response,
) => {
    const [existing] = await pool.query(`
            SELECT id FROM folders WHERE id = ? AND user_id = ?
        `, [req.params.id, req.user!.id]
    )
    if((existing as any[]).length === 0) {
        res.status(404).json({ error: 'Folder Not Found'})
    }

    await pool.query(`
            DELETE FROM folders WHERE id = ?
        `, [req.params.id]
    )
    return res.status(204).send()
}))

export default router;