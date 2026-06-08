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
