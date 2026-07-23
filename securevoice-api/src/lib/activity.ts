import pool from '../db/connection';
import { getIO } from '../socket';
import { v4 as uuidv4 } from 'uuid';

export type ActivityEvent =
  | 'note_created'
  | 'note_updated'
  | 'collaborator_joined'
  | 'block_added'
  | 'block_edited'
  | 'block_deleted';

export async function logActivity(params: {
  noteId: string;
  userId: string;
  username: string;
  event: ActivityEvent;
  blockId?: string;
}): Promise<string> {
  const id = uuidv4();

  await pool.query(
    `INSERT INTO note_activity (id, note_id, user_id, username, event, block_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, params.noteId, params.userId, params.username, params.event, params.blockId ?? null],
  );

  const [rows] = await pool.query(
    `SELECT created_at FROM note_activity WHERE id = ? LIMIT 1`,
    [id],
  );
  const created_at = (rows as any[])[0]?.created_at ?? new Date();

  try {
    getIO().to(`note:${params.noteId}`).emit('note:activity', {
      noteId: params.noteId,
      entry: {
        id,
        user_id:  params.userId,
        username: params.username,
        event:    params.event,
        block_id: params.blockId ?? null,
        created_at,
      },
    });
  } catch {
    // Socket not initialized — silent
  }

  return id;
}