// ----- User ---------------------------------------------------
export interface User {
    id: string,
    email: string,
    username: string,
    first_name: string,
    last_name: string,
    dek_salt: string,
    dek: string,
    public_key: string,
    private_key_enc: string
}

// ----- Folder ---------------------------------------------------
export interface Folder{
    id: string,
    name: string,
    user_id: string,
    color: string,
    created_at: string
}

// ----- Note ---------------------------------------------------

export type NoteType = 'private' | 'public';
export type EncMethod = 'symmetric' | 'asymmetric';
export type NoteRole = 'owner' | 'editor';

/* Raw note as returned by the API - content is encrypted **/
export interface RawNote {
    id: string,
    owner_id: string,
    folder_id: string | null,
    type: NoteType,
    content_iv: string,
    content_cipher: string,
    pinned: number | boolean,
    created_at: string,
    updated_at: string,
    enc_note_dek: string,
    enc_method: EncMethod,
    role: NoteRole
}

/** Note after the client has decrypted content */
export interface DecryptedNote {
    id: string,
    author_id: string,
    created_at: string,
    text: string
}

// ----- Block ---------------------------------------------------
export interface RawBlock {
    id: string,
    note_id: string,
    author_id: string,
    content_iv: string,
    content_cipher: string,
    created_at: string
}
/* Block after client has decrypted RawBlock **/
export interface DecryptedBlock {
    id: string,
    author_id: string,
    created_at: string,
    text: string
}


// ----- Invite ---------------------------------------------------
export interface PendingInvite {
    id: string,
    note_id: string,
    token: string,
    enc_note_dek: string,
    inviter_username: string,
    expires_at: string
}

