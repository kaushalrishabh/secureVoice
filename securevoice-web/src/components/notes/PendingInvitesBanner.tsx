import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  getPendingInvites,
  acceptInvite,
  declineInvite,
  type PendingInvite,
} from '../../services/invites.service';
import { getSocket } from '../../lib/socket';

interface PendingInvitesBannerProps {
  onAccepted: (noteId: string) => void;
  socketReady: boolean
}

export default function PendingInvitesBanner({ onAccepted, socketReady }: PendingInvitesBannerProps) {
  const [invites, setInvites]       = useState<PendingInvite[]>([]);
  const [loading, setLoading]       = useState(true);
  const [collapsed, setCollapsed]   = useState(false);
  const [busyToken, setBusyToken]   = useState<string | null>(null);

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    function handleInviteReceived(payload: {
      inviteId: string;
      noteId: string;
      inviterUsername: string;
      token: string;
      enc_note_dek: string;
      expires_at: string;
      created_at: string;
    }) {
      const newInvite: PendingInvite = {
        id:               payload.inviteId,
        note_id:          payload.noteId,
        token:            payload.token,
        enc_note_dek:     payload.enc_note_dek,
        inviter_username: payload.inviterUsername,
        expires_at:       payload.expires_at,
        created_at:       payload.created_at,
      };
      setInvites((prev) => {
        if (prev.some((i) => i.token === newInvite.token)) return prev;
        return [newInvite, ...prev];
      });
      setCollapsed(false);
      toast(`${payload.inviterUsername} shared a note with you`, { icon: '📩' });
    }

    socket.on('invite:received', handleInviteReceived);
    return () => { socket.off('invite:received', handleInviteReceived); };
  }, [socketReady]);

  async function refresh() {
    try {
      const list = await getPendingInvites();
      setInvites(list);
    } 
    catch (err: any) {
      console.error('Failed to load pending invites:', err);
    } 
    finally {
      setLoading(false);
    }
  }

  async function handleAccept(invite: PendingInvite) {
    setBusyToken(invite.token);
    try {
      const { note_id } = await acceptInvite(invite);
      setInvites((prev) => prev.filter((i) => i.token !== invite.token));
      toast.success(`You now have access to ${invite.inviter_username}'s note`);
      onAccepted(note_id);
    } 
    catch (err: any) {
      toast.error(err.message ?? 'Failed to accept invite');
    } 
    finally {
      setBusyToken(null);
    }
  }

  async function handleDecline(invite: PendingInvite) {
    setBusyToken(invite.token);
    try {
      await declineInvite(invite.token);
      setInvites((prev) => prev.filter((i) => i.token !== invite.token));
      toast.success('Invite declined');
    }
    catch (err: any) {
      toast.error(err.message ?? 'Failed to decline invite');
    }
    finally {
      setBusyToken(null);
    }
  }

  if (loading || invites.length === 0) return null;

 return (
    <div style={{ borderBottom: '0.5px solid var(--sv-border)', background: 'var(--sv-accent-dim)' }}>
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-5 py-2.5"
      >
        <div className="flex items-center gap-2">
          <i className="ti ti-mail" style={{ fontSize: 15, color: 'var(--sv-accent)' }} aria-hidden="true" />
          <span className="text-[13px] font-medium" style={{ color: 'var(--sv-accent)' }}>
            {invites.length === 1 ? '1 pending invite' : `${invites.length} pending invites`}
          </span>
        </div>
        <i
          className={`ti ${collapsed ? 'ti-chevron-down' : 'ti-chevron-up'}`}
          style={{ fontSize: 15, color: 'var(--sv-accent)' }}
          aria-hidden="true"
        />
      </button>

      {!collapsed && (
        <div className="px-5 pb-3 space-y-2">
          {invites.map((invite) => {
            const busy = busyToken === invite.token;
            return (
              <div
                key={invite.token}
                className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-[10px]"
                style={{ background: 'var(--sv-surface)', border: '0.5px solid var(--sv-accent-border)' }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--sv-accent)' }}
                  >
                    <span className="text-[10px] font-medium" style={{ color: 'var(--sv-bg)' }}>
                      {invite.inviter_username.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[13px] truncate" style={{ color: 'var(--sv-text)' }}>
                    <span className="font-medium">{invite.inviter_username}</span> shared a note with you
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleAccept(invite)}
                    disabled={busy}
                    className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-opacity disabled:opacity-50"
                    style={{ background: 'var(--sv-accent)', color: 'var(--sv-bg)' }}
                  >
                    {busy ? '…' : 'Accept'}
                  </button>
                  <button
                    onClick={() => handleDecline(invite)}
                    disabled={busy}
                    className="px-3 py-1.5 rounded-lg text-[12px] transition-opacity hover:opacity-70 disabled:opacity-50"
                    style={{ color: 'var(--sv-text-3)', border: '0.5px solid var(--sv-border-2)' }}
                  >
                    Decline
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}