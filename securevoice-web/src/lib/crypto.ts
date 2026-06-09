/**
 * crypto.ts — SecureVoice client-side cryptography
 *
 * All functions run entirely in the browser via the Web Crypto API.
 * Nothing in this file ever sends data anywhere — that is the caller's job.
 *
 * Encoding convention throughout:
 *   All binary values crossing the JS boundary (stored in DB, sent over wire)
 *   are base64url strings. Binary staying inside a single call is ArrayBuffer/Uint8Array.
 *
 * AES-GCM blob layout:  base64url( IV[12] || ciphertext || tag[16] )
 *   The first 12 bytes are always the IV. The rest is ciphertext + GCM auth tag.
 *   This matches the format the Python test-payload generator produces.
*/

// --- Constants --------------------------------

const GLOBAL_SALT = new TextEncoder().encode('securevoice-global-v1');
const PBKDF2_ITERATIONS = 50000;

// --- Base64 Helpers ---------------------------

export function toBase64Url(buffer: ArrayBuffer | Uint8Array) : string {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let newString = '';
    for(const b of bytes) newString += String.fromCharCode(b);
    return btoa(newString)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

export function fromBase64url(str: string): ArrayBuffer {
  const padded = str
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(str.length + (4 - (str.length % 4)) % 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// --- Generic Text Encryption

/**
 * Encrypt a plain string with AES-256-GCM
 * Return seperat iv and cipher as base64url strings
 * Used for note blocks
*/
export async function encrypt(
    data: string,
    key: CryptoKey
) : Promise<{ iv: string, cipher: string }> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipherText = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv},
        key,
        new TextEncoder().encode(data)
    );
    return {
        iv: toBase64Url(iv),
        cipher: toBase64Url(cipherText)
    }
}

/**
 * Decrypt AES-256-GCM ciphertext back to a plain string.
 * iv and cipher are seperate base64url string matching the encrypt() output
*/
export async function decrypt(
    iv: string,
    cipher: string,
    key: CryptoKey
) : Promise <string>{
    const plainText = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: fromBase64url(iv) },
        key,
        fromBase64url(cipher)
    )
    return new TextDecoder().decode(plainText);
}

// ── Key derivation ────────────────────────────────────────────────────────────
 
/**
 * Step 1 of auth: derive client_hash from the raw password.
 * This is what gets sent to the server instead of the password.
 * Returns the raw bytes — caller converts to base64url for transport.
*/

export async function deriveClientHash (password: string): Promise<ArrayBuffer> {
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
    );

    return crypto.subtle.deriveBits(
        { 
            name: 'PBKDF2',
            hash: "SHA-256",
            salt: GLOBAL_SALT,
            iterations: PBKDF2_ITERATIONS 
        },
        keyMaterial,
        256
    );
}

/**
 * Derive the Key Encryption Key from client_hash + dek_salt.
 * KEK is ephemeral — it only exists in RAM long enough to wrap/unwrap user_DEK.
 * dekSalt is a base64url string as stored in the DB / returned by the server.
*/
export async function deriveKEK(
    clientHash: ArrayBuffer,
    dekSalt: string,
) : Promise<CryptoKey> {
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        clientHash,
        'PBKDF2',
        false,
        ['deriveBits'],
    );
    const kekBits = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            hash: 'SHA-256',
            salt: fromBase64url(dekSalt),
            iterations: PBKDF2_ITERATIONS,
        },
        keyMaterial,
        256,
    );
    return crypto.subtle.importKey(
        'raw',
        kekBits,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt'],
    );
}

// ── Symmetric DEK operations ──────────────────────────────────────────────────
 
/** Generate a fresh random 256-bit AES-GCM key (user_DEK or note_DEK). */
export function generateDEK(): Promise<CryptoKey> {
    return crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt'],
    );
}

/**
 * Wrap a DEK with an AES-GCM wrapping key (KEK or user_DEK).
 * Returns base64url( IV[12] || ciphertext || tag[16] ).
*/
export async function wrapDEK(dek: CryptoKey, wrappingKey: CryptoKey): Promise<string> {
    const rawDEK = await crypto.subtle.exportKey('raw', dek);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        wrappingKey,
        rawDEK,
    );
    const blob = new Uint8Array(12 + ciphertext.byteLength);
    blob.set(iv, 0);
    blob.set(new Uint8Array(ciphertext), 12);
    return toBase64Url(blob);
}
 
/**
 * Unwrap a DEK from a base64url blob using an AES-GCM wrapping key.
 * Returns an extractable CryptoKey so the DEK can later be re-wrapped for sharing.
*/
export async function unwrapDEK(wrapped: string, wrappingKey: CryptoKey): Promise<CryptoKey> {
    const blob = new Uint8Array(fromBase64url(wrapped));
    const iv = blob.slice(0, 12);
    const ciphertext = blob.slice(12);
    const rawDEK = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, wrappingKey, ciphertext);
    return crypto.subtle.importKey(
        'raw',
        rawDEK,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt'],
    );
}
 
// ── Note encryption/decryption ────────────────────────────────────────────────
 
/**
 * Encrypt note content with a note_DEK.
 * The payload is serialised as JSON so title + body travel together —
 * matching the schema design (single content_cipher column, no separate title).
*/
export async function encryptNote(
  payload: { title: string; content: string },
  noteDEK: CryptoKey,
): Promise<{ content_iv: string; content_cipher: string }> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(JSON.stringify(payload));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, noteDEK, plaintext);
    return {
        content_iv: toBase64Url(iv),
        content_cipher: toBase64Url(ciphertext),
    };
}
 
/** Decrypt note content — returns { title, content }. */
export async function decryptNote(
  content_iv: string,
  content_cipher: string,
  noteDEK: CryptoKey,
): Promise<{ title: string; content: string }> {
    const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: fromBase64url(content_iv) },
        noteDEK,
        fromBase64url(content_cipher),
    );
    return JSON.parse(new TextDecoder().decode(plaintext));
}
 
// ── RSA keypair — used for sharing ───────────────────────────────────────────
 
/** Generate an RSA-2048 / RSA-OAEP keypair for the sharing flow. */
export function generateRSAKeyPair(): Promise<CryptoKeyPair> {
    return crypto.subtle.generateKey(
        {
            name: 'RSA-OAEP',
            modulusLength: 2048,
            publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
            hash: 'SHA-256',
        },
        true,
        ['encrypt', 'decrypt'],
    );
}
 
/** Export RSA public key as base64url SPKI — stored in users.public_key. */
export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
    const spki = await crypto.subtle.exportKey('spki', publicKey);
    return toBase64Url(spki);
}
 
/**
 * Encrypt the RSA private key (PKCS8) with user_DEK and return base64url blob.
 * Stored in users.private_key_enc — the server never sees the plaintext.
*/
export async function exportEncryptedPrivateKey(
  privateKey: CryptoKey,
  userDEK: CryptoKey,
): Promise<string> {
    const pkcs8 = await crypto.subtle.exportKey('pkcs8', privateKey);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, userDEK, pkcs8);
    const blob = new Uint8Array(12 + ciphertext.byteLength);
    blob.set(iv, 0);
    blob.set(new Uint8Array(ciphertext), 12);
    return toBase64Url(blob);
}
 
/** Import an RSA public key from a base64url SPKI string. */
export async function importPublicKey(spki: string): Promise<CryptoKey> {
    return crypto.subtle.importKey(
        'spki',
        fromBase64url(spki),
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        false,
        ['encrypt'],
    );
}
 
/**
 * Decrypt and import the RSA private key from users.private_key_enc.
 * Called once after login — result stored in session memory.
*/
export async function importEncryptedPrivateKey(
  encPrivateKey: string,
  userDEK: CryptoKey,
): Promise<CryptoKey> {
    const blob = new Uint8Array(fromBase64url(encPrivateKey));
    const iv = blob.slice(0, 12);
    const ciphertext = blob.slice(12);
    const pkcs8 = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, userDEK, ciphertext);
    return crypto.subtle.importKey(
        'pkcs8',
        pkcs8,
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        false,
        ['decrypt'],
    );
}
 
// ── Asymmetric DEK wrapping — used in the sharing flow ───────────────────────
 
/**
 * Wrap a note_DEK with a recipient's RSA public key.
 * The result (enc_note_dek) is stored in invites.enc_note_dek.
 * Only the recipient's RSA private key can unwrap it.
*/
export async function wrapDEKWithRSA(
  noteDEK: CryptoKey,
  recipientPublicKey: CryptoKey,
): Promise<string> {
    const rawDEK = await crypto.subtle.exportKey('raw', noteDEK);
    const encrypted = await crypto.subtle.encrypt(
        { name: 'RSA-OAEP' },
        recipientPublicKey,
        rawDEK,
    );
    return toBase64Url(encrypted);
}
 
/**
 * Unwrap a note_DEK using the recipient's RSA private key.
 * Returns an extractable CryptoKey so it can immediately be re-wrapped
 * symmetrically with user_DEK when accepting the invite.
*/
export async function unwrapDEKWithRSA(
  encNoteDEK: string,
  privateKey: CryptoKey,
): Promise<CryptoKey> {
    const rawDEK = await crypto.subtle.decrypt(
        { name: 'RSA-OAEP' },
        privateKey,
        fromBase64url(encNoteDEK),
    );
    return crypto.subtle.importKey(
        'raw',
        rawDEK,
        { name: 'AES-GCM', length: 256 },
        true,                          // extractable — needs to be re-wrapped in accept flow
        ['encrypt', 'decrypt'],
    );
}
 