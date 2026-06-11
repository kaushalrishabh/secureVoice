/**
 * notes.service.ts — Create and Save note flows
 *
 * Every note gets its own note_DEK. The DEK is generated fresh on creation,
 * wrapped symmetrically with user_DEK, and stored server-side as enc_note_dek.
 * Note content is encrypted before the POST — the server only ever sees ciphertext.
 *
 * A module-level Map caches decrypted note_DEKs for the session so open notes
 * don't need to re-unwrap their DEK on every save.
*/

import { 
    generateDEK,
    wrapDEK,
    unwrapDEK,
    encryptNote,
    decryptNote,
    encrypt,
    decrypt
 } from "../lib/crypto";
 
import { requireUserDEK } from "../lib/session";
import { apiFetch } from "../lib/api";

// --- Types -----------------------------------

export interface NotePayload {
    title: string;
    content: string;
}

export interface NoteKey {
    enc_note_dek: string;
    enc_method: 'symmetric' | 'asymmetric';
    role: 'owner' | 'editor';
}

export interface Note {
    id: string;
    owner_id: string;
    folder_id: string | null,
    type: 'private' | 'shared';
    content_iv: string;
    content_cipher: string;
    pinned: boolean;
    created_at: string;
    updated_at: string;
    enc_note_dek: string;
    enc_method: 'symmetric' | 'asymmetric';
    role: 'owner' | 'editor'
}

export interface DecryptedNote extends NotePayload {
    id: string;
    folder_id: string | null;
    type: 'private' | 'shared';
    pinned: boolean;
    role: 'owner' | 'editor';
    created_at: string;
    updated_at: string;
}

// --- Session-scoped note_DEK cache ------------------

/** noteID -> decrypted CryptoKey. Lives in RAM */
const noteDEKCache = new Map<string, CryptoKey>();

async function getNoteDEK(
    noteId: string,
    encNoteDEK: string,
) : Promise <CryptoKey> {
    if(noteDEKCache.has(noteId)) return noteDEKCache.get(noteId)!;

    const userDEK = requireUserDEK();
    const noteDEK = await unwrapDEK(encNoteDEK, userDEK);
    noteDEKCache.set(noteId, noteDEK);
    return noteDEK;
}

// --- Create Note -----------------------------------

/**
 * Creates a new Note
 *  1. Generate a fresh note_DEK
 *  2. Wrap note_DEK with user_DEK -> enc_note_dek
 *  3. Encrypt { title, cipher } with note_DEK -> { content_iv, content_cipher }
 *  4. POST note + key to server in one request
 *  5. Cache the note_DEK for the session
*/
export async function createNote(
    payload: NotePayload,
    options: { 
        folder_id?: string,
        pinned?: boolean
    } = {},
): Promise <DecryptedNote> {
    const userDEK = requireUserDEK();

    // Generate and wrap note_DEK
    const noteDEK = await generateDEK();
    const enc_note_dek = await wrapDEK(noteDEK, userDEK)

    // Encrypt content
    const { content_iv, content_cipher } = await encryptNote(payload, noteDEK);

    // Send to Server
    const { note } = await apiFetch<{ note: Note }>('/api/notes', {
        method: 'POST',
        body: JSON.stringify({
            content_iv,
            content_cipher,
            folder_id: options.folder_id ?? null,
            pinned: options.pinned ?? false,
            note_key: {
                enc_note_dek, 
                enc_method: 'symmetric'
            }
        }),
    });

    // Cache note_DEK
    noteDEKCache.set(note.id, noteDEK)

    return {
        id: note.id,
        folder_id: note.folder_id,
        type: note.type,
        pinned: Boolean(note.pinned),
        role: note.role,
        created_at: note.created_at,
        updated_at: note.updated_at,
        ...payload
    }
};

// --- Fetch and Decrypt a single note -----------------

/**
 * Fetches a note from the server and decrypts it locally
 * Also populates the note_DEK cache if it isn't already there.
*/
export async function fetchNote(
    noteId: string,
): Promise <DecryptedNote> {
    const { note } = await apiFetch<{ note: Note }>( `/api/notes/${noteId}`);
    const noteDEK = await getNoteDEK(noteId, note.enc_note_dek);
    const { title, content } = await decryptNote(note.content_iv, note.content_cipher, noteDEK);

    return {
        id: note.id,
        folder_id : note.folder_id,
        type: note.type,
        pinned: Boolean(note.pinned),
        role: note.role,
        created_at: note.created_at,
        updated_at: note.updated_at,
        title,
        content
    };
}

// --- Fetch and decrypt note list ---------------

/**
 * List all the notes of a user has access to, decrypting each one's content-cipher
 * for the title, Heavier than a lighweight list but necessary since title is encrypted inside the content-cipher
 * no separate plain text title column
*/
export async function listNotes(
    folderId?: string,
): Promise <DecryptedNote[]> {
    const qs = folderId ? `folder_id=${folderId}` : '';
    const { notes } = await apiFetch<{ notes: Note[] }>(`/api/notes${qs}`);

    return Promise.all(
        notes.map(async (note) => {
            const noteDEK = await getNoteDEK(note.id, note.enc_note_dek);
            const { title, content } = await decryptNote(note.content_iv, note.content_cipher, noteDEK);
            return {
                id: note.id,
                folder_id: note.folder_id,
                type: note.type,
                pinned: Boolean(note.pinned),
                role: note.role,
                created_at: note.created_at,
                updated_at: note.updated_at,
                title,
                content
            };
        }),
    );
};

// ── Save (update) note ────────────────────────────────────────────────────────
 
/**
 * Updates a note's encrypted content.
 *   1. Retrieve the cached note_DEK (must have opened the note first)
 *   2. Re-encrypt the updated payload
 *   3. PUT to server — MySQL updated_at is set by ON UPDATE CURRENT_TIMESTAMP
 */
export async function saveNote(
  noteId: string,
  payload: Partial<NotePayload> & { encNoteDEK?: string; pinned?: boolean; folderId?: string | null },
): Promise<void> {
  const body: Record<string, unknown> = {};
 
  if (payload.title !== undefined || payload.content !== undefined) {
    // Need to re-encrypt — get the cached DEK or unwrap from provided blob
    let noteDEK: CryptoKey;
    if (noteDEKCache.has(noteId)) {
      noteDEK = noteDEKCache.get(noteId)!;
    } else if (payload.encNoteDEK) {
      noteDEK = await getNoteDEK(noteId, payload.encNoteDEK);
    } else {
      throw new Error(`note_DEK not in cache for ${noteId} — open the note before saving.`);
    }
 
    // We need current title+content to re-encrypt. Caller should pass both even on partial edits.
    if (payload.title === undefined || payload.content === undefined) {
      throw new Error('Provide both title and content when updating note body.');
    }
    const { content_iv, content_cipher } = await encryptNote(
      { title: payload.title, content: payload.content },
      noteDEK,
    );
    body.content_iv = content_iv;
    body.content_cipher = content_cipher;
  }
 
  if (payload.pinned   !== undefined) body.pinned    = payload.pinned;
  if (payload.folderId !== undefined) body.folder_id = payload.folderId;
 
  await apiFetch(`/api/notes/${noteId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}
 
// ── Pin / unpin convenience ───────────────────────────────────────────────────
 
export function pinNote(noteId: string, pinned: boolean): Promise<void> {
  return saveNote(noteId, { pinned });
}

/** Returns the cached note_DEK for a note — needed externally for sharing. */
export function getCachedNoteDEK(noteId: string): CryptoKey | null {
  return noteDEKCache.get(noteId) ?? null;
}

// ── Delete note ───────────────────────────────────────────────────────────────
 
export async function deleteNote(noteId: string): Promise<void> {
  await apiFetch(`/api/notes/${noteId}`, { method: 'DELETE' });
  noteDEKCache.delete(noteId);
}
 
// ── Blocks ────────────────────────────────────────────────────────────────────
 
export interface DecryptedBlock {
  id: string;
  author_id: string;
  created_at: string;
  text: string;
}
 
/**
 * Fetch and decrypt all blocks for a note.
 * The note_DEK must already be cached — call fetchNote() or listNotes() first.
 */
export async function fetchDecryptedBlocks(noteId: string): Promise<DecryptedBlock[]> {
  const noteDEK = noteDEKCache.get(noteId);
  if (!noteDEK) throw new Error('Note DEK not cached — open the note first.');
 
  const { blocks } = await apiFetch<{
    blocks: Array<{ id: string; author_id: string; content_iv: string; content_cipher: string; created_at: string }>;
  }>(`/api/notes/${noteId}/blocks`);
 
  return Promise.all(
    blocks.map(async (b) => {
      try {
        const text = await decrypt(b.content_iv, b.content_cipher, noteDEK);
        return { id: b.id, author_id: b.author_id, created_at: b.created_at, text };
      } catch {
        return { id: b.id, author_id: b.author_id, created_at: b.created_at, text: '[Decryption failed]' };
      }
    }),
  );
}
 
/**
 * Encrypt a text string and post it as a new block on a shared note.
 * The note_DEK must already be cached.
 */
export async function addBlock(noteId: string, text: string): Promise<DecryptedBlock> {
  const noteDEK = noteDEKCache.get(noteId);
  if (!noteDEK) throw new Error('Note DEK not cached — open the note first.');
 
  const { iv: content_iv, cipher: content_cipher } = await encrypt(text, noteDEK);
 
  const { block } = await apiFetch<{
    block: { id: string; author_id: string; content_iv: string; content_cipher: string; created_at: string };
  }>(`/api/notes/${noteId}/blocks`, {
    method: 'POST',
    body: JSON.stringify({ content_iv, content_cipher }),
  });
 
  return { id: block.id, author_id: block.author_id, created_at: block.created_at, text };
}
 