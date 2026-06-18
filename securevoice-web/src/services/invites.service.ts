/**
 * invites.service.ts — Share invite, Accept invite, and Decline invite flows
 *
 * Sharing flow (inviter):
 *   Fetch invitee's RSA public key → wrap note_DEK with it → POST invite.
 *   The server stores the RSA-wrapped blob; it cannot read it.
 *
 * Accept flow (invitee):
 *   Fetch pending invites → RSA-decrypt enc_note_dek → re-wrap with user_DEK
 *   (symmetric) → POST back. The key is now symmetric and the note is accessible.
 *
 * Decline flow (invitee):
 *   Simple status flip on the server — no crypto involved, since the invitee
 *   never had a usable key for the note to begin with.
 */

import {
  importPublicKey,
  wrapDEKWithRSA,
  unwrapDEKWithRSA,
  wrapDEK,
} from '../lib/crypto';
import { requireUserDEK, requirePrivateKey } from '../lib/session';
import { apiFetch } from '../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PendingInvite {
  id: string;
  note_id: string;
  token: string;
  enc_note_dek: string;
  inviter_username: string;
  expires_at: string;
  created_at: string;
}

// ── Share invite ──────────────────────────────────────────────────────────────

/**
 * Sends a sharing invite for a note:
 *   1. Fetch the invitee's RSA public key from the server
 *   2. Retrieve the note_DEK from the session cache
 *   3. Wrap note_DEK with the invitee's public key → enc_note_dek (RSA-OAEP)
 *   4. POST to /api/notes/:noteId/invite
 */
export async function shareNote(
  noteId: string,
  inviteeEmail: string,
  noteDEK: CryptoKey,
): Promise<{ token: string; expires_at: string }> {

  const { public_key } = await apiFetch<{ username: string; public_key: string }>(
    `/api/users/public-key?email=${encodeURIComponent(inviteeEmail)}`,
  );

  const recipientPublicKey = await importPublicKey(public_key);
  const enc_note_dek = await wrapDEKWithRSA(noteDEK, recipientPublicKey);

  const { invite } = await apiFetch<{
    invite: { id: string; token: string; invitee_email: string; expires_at: string };
  }>(`/api/notes/${noteId}/invite`, {
    method: 'POST',
    body: JSON.stringify({ invitee_email: inviteeEmail, enc_note_dek }),
  });

  return { token: invite.token, expires_at: invite.expires_at };
}

// ── Fetch pending invites ────────────────────────────────────────────────────

export async function getPendingInvites(): Promise<PendingInvite[]> {
  const { invites } = await apiFetch<{ invites: PendingInvite[] }>('/api/invites');
  return invites;
}

// ── Accept invite ─────────────────────────────────────────────────────────────

/**
 * Accepts a pending invite:
 *   1. RSA-decrypt enc_note_dek using invitee's RSA private key → plain note_DEK
 *   2. Re-wrap note_DEK with user_DEK (AES-GCM symmetric)
 *   3. POST the new enc_note_dek to /api/invites/:token/accept
 */
export async function acceptInvite(invite: PendingInvite): Promise<{ note_id: string }> {
  const userDEK       = requireUserDEK();
  const rsaPrivateKey  = requirePrivateKey();

  const noteDEK = await unwrapDEKWithRSA(invite.enc_note_dek, rsaPrivateKey);
  const enc_note_dek = await wrapDEK(noteDEK, userDEK);

  const result = await apiFetch<{ message: string; note_id: string }>(
    `/api/invites/${invite.token}/accept`,
    { method: 'POST', body: JSON.stringify({ enc_note_dek }) },
  );

  return { note_id: result.note_id };
}

/**
 * Convenience: accept all pending invites in one call.
 * Returns an array of the note_ids that are now accessible.
 */
export async function acceptAllInvites(): Promise<string[]> {
  const invites = await getPendingInvites();
  const results = await Promise.allSettled(invites.map(acceptInvite));
  return results
    .filter((r): r is PromiseFulfilledResult<{ note_id: string }> => r.status === 'fulfilled')
    .map((r) => r.value.note_id);
}

// ── Decline invite ────────────────────────────────────────────────────────────

/**
 * Declines a pending invite — no crypto operations needed.
 * The inviter's enc_note_dek blob is simply orphaned server-side.
 */
export async function declineInvite(token: string): Promise<void> {
  await apiFetch(`/api/invites/${token}/decline`, { method: 'POST' });
}