import {
  toBase64Url, fromBase64url, importEncryptedPrivateKey,
} from '../lib/crypto';

// const DEK_KEY = 'sv_dek';
function dekKey(userId: string) {
  return `sv_dek_${userId}`;
}
/**
 * session.ts — in-memory runtime key store
 *
 * CryptoKey objects cannot be JSON-serialised, so they cannot live in
 * Zustand's persisted store or localStorage. This module holds them in a
 * plain object that lives as long as the browser tab. On tab close or
 * explicit sign-out, the keys are gone — that's intentional.
 *
 * Nothing here writes to disk. Import { getSession, setSession, clearSession }
 * from services that need runtime key access.
*/

export interface SessionKey {
    userDEK: CryptoKey | null,
    RSAPrivateKey: CryptoKey | null
}

const session: SessionKey = {
    userDEK: null,
    RSAPrivateKey : null
};

export function setSession(keys: Partial<SessionKey>): void {
    if(keys.userDEK !== undefined)      session.userDEK = keys.userDEK
    if(keys.RSAPrivateKey !== undefined)    session.RSAPrivateKey = keys.RSAPrivateKey;
}

export function getSession(): SessionKey{
    return session;
}

// Calls on Signout. Keys are dereferences and GC'd
export function clearSession () : void {
    session.userDEK = null;
    session.RSAPrivateKey = null
}

// Throw error if user_DEK is missing - catches calls made before login
export function requireUserDEK(): CryptoKey {
    if(!session.userDEK)    throw new Error('No Active Session - Please Log In');
    return session.userDEK
}

// Throw error if RSA Private Key is missing - catches calls made before login
export function requirePrivateKey(): CryptoKey {
    if(!session.RSAPrivateKey)    throw new Error('No Active Session - Please Log In');
    return session.RSAPrivateKey
}

/** Saves user_DEK raw bytes to sessionStorage. Survives refresh, clears on tab close. */
export async function persistSessionDEK(userDEK: CryptoKey, userId: string): Promise<void> {
  try {
    const raw = await crypto.subtle.exportKey('raw', userDEK);
    sessionStorage.setItem(dekKey(userId), toBase64Url(raw));
  } catch (e) {
    console.warn('Could not persist session DEK:', e);
  }
}

/**
 * Tries to restore session from sessionStorage.
 * Needs the encrypted private key (from Zustand store) to re-derive the RSA key.
 * Returns true if successful, false if sessionStorage is empty or corrupt.
 */
export async function tryRestoreSession(privateKeyEnc: string, userId: string): Promise<boolean> {
  const stored = sessionStorage.getItem(dekKey(userId));
  if (!stored) return false;

  try {
    const userDEK = await crypto.subtle.importKey(
      'raw',
      fromBase64url(stored),
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt'],
    );
    const rsaPrivateKey = await importEncryptedPrivateKey(privateKeyEnc, userDEK);
    session.userDEK       = userDEK;
    session.RSAPrivateKey = rsaPrivateKey;
    return true;
  } catch {
    sessionStorage.removeItem(dekKey(userId));
    return false;
  }
}

/** Call on sign-out. */
export function clearPersistedSession(userId: string): void {
  sessionStorage.removeItem(dekKey(userId));
}