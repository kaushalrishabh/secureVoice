/**
 * auth.service.ts — Register and Login flows
 *
 * Register: runs all crypto locally, then sends opaque blobs to the server.
 * Login:    receives opaque blobs from the server, reconstructs session keys locally.
 *
 * The raw password and all plaintext keys never leave the browser.
*/

import { 
    deriveClientHash,
    deriveKEK,
    generateDEK,
    wrapDEK,
    unwrapDEK,
    generateRSAKeyPair,
    exportPublicKey,
    exportEncryptedPrivateKey,
    importEncryptedPrivateKey,
    toBase64Url
 } from "../lib/crypto";

import { setSession, clearSession } from "../lib/session";
import { apiFetch } from "../lib/api";

// --- Types ---------------------------------------------

interface AuthUser {
    id: string,
    email: string,
    username: string,
    dek_salt: string,
    dek: string,
    public_key: string,
    private_key_enc: string 
}

interface AuthResponse {
    token: string,
    data: AuthUser
}

// --- Register ---------------------------------------------

/**
 * Full registration flow:
 *   1. Derive client_hash from password (never send the raw password)
 *   2. Generate dek_salt, derive KEK, generate user_DEK, wrap it
 *   3. Generate RSA-2048 keypair for the sharing flow
 *   4. POST everything to the server — server generates auth_salt and runs Argon2id
 *   5. Persist the JWT, store session keys in RAM
*/
export async function register(
    email: string,
    username: string,
    password: string,
    firstName: string,
    lastName: string,
): Promise<AuthUser> {
 
    // ── Step 1: password → client_hash ──────────────────────────────────────
    const clientHashBuf = await deriveClientHash(password);
    const client_hash = toBase64Url(clientHashBuf);         // sent to server
    
    // ── Step 2: generate dek_salt, derive KEK, wrap user_DEK ────────────────
    const dekSaltBytes = crypto.getRandomValues(new Uint8Array(32));
    const dek_salt     = toBase64Url(dekSaltBytes);           // stored in DB, returned at login
    
    const kek          = await deriveKEK(clientHashBuf, dek_salt);  // ephemeral
    const userDEK      = await generateDEK();
    const wrapped_dek  = await wrapDEK(userDEK, kek);         // stored in DB
    
    // ── Step 3: RSA keypair for sharing ─────────────────────────────────────
    const { publicKey, privateKey } = await generateRSAKeyPair();
    const public_key      = await exportPublicKey(publicKey);
    const private_key_enc = await exportEncryptedPrivateKey(privateKey, userDEK);
    
    // ── Step 4: send to server ───────────────────────────────────────────────
    const { token, data } = await apiFetch<AuthResponse>('/api/auth/registration', {
        method: 'POST',
        body: JSON.stringify({
        email,
        username,
        first_name: firstName,
        last_name: lastName,
        client_hash,
        dek_salt,
        wrapped_dek,
        public_key,
        private_key_enc,
        }),
    });
    
    // ── Step 5: persist token, load session keys ─────────────────────────────
    localStorage.setItem('sv_token', token);
    setSession({ userDEK, RSAPrivateKey: privateKey });
    
    return data;
}
 
// ── Login ─────────────────────────────────────────────────────────────────────
 
/**
 * Full login flow:
 *   1. Derive client_hash from password
 *   2. POST client_hash to server — server re-hashes and compares
 *   3. Use server-returned dek_salt + dek to reconstruct user_DEK locally
 *   4. Decrypt RSA private key using user_DEK
 *   5. Persist JWT, store session keys in RAM
*/
export async function login(email: string, password: string): Promise<AuthUser> {
 
  // ── Step 1: derive client_hash ───────────────────────────────────────────
  const clientHashBuf = await deriveClientHash(password);
  const client_hash   = toBase64Url(clientHashBuf);
 
  // ── Step 2: authenticate ─────────────────────────────────────────────────
  const { token, data } = await apiFetch<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, client_hash }),
  });
  console.log("dfmdslk", token, data)
  // ── Step 3: reconstruct user_DEK ─────────────────────────────────────────
  // dek_salt and dek are opaque blobs — we use them to re-derive KEK and
  // unwrap user_DEK, exactly reversing what register() did.
  const kek     = await deriveKEK(clientHashBuf, data.dek_salt);   // ephemeral
  const userDEK = await unwrapDEK(data.dek, kek);
 
  // ── Step 4: decrypt RSA private key ──────────────────────────────────────
  const rsaPrivateKey = await importEncryptedPrivateKey(data.private_key_enc, userDEK);
 
  // ── Step 5: persist token, store session keys ─────────────────────────────
  localStorage.setItem('sv_token', token);
  setSession({ userDEK, RSAPrivateKey: rsaPrivateKey });
 
  return data;
}
 
// ── Sign out ──────────────────────────────────────────────────────────────────
 
export function signOut(): void {
  localStorage.removeItem('sv_token');
  clearSession();
}
 