import { useState, useEffect } from 'react';
import type { ActivityEntry } from '../../services/activity.service';

const EVENT_LABELS: Record<string, string> = {
  note_created:        'created this note',
  note_updated:        'edited the note',
  collaborator_joined: 'joined as collaborator',
  block_added:         'added a contribution',
  block_edited:        'edited a contribution',
  block_deleted:       'removed a contribution',
};

const EVENT_ICONS: Record<string, string> = {
  note_created:        'ti-file-plus',
  note_updated:        'ti-pencil',
  collaborator_joined: 'ti-user-plus',
  block_added:         'ti-plus',
  block_edited:        'ti-edit',
  block_deleted:       'ti-trash',
};

function relTime(d: string) {
  const dt   = new Date(d);
  const diff = Date.now() - dt.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface ActivityPanelProps {
  activity: ActivityEntry[];
  loading: boolean;
}

export default function ActivityPanel({ activity, loading }: ActivityPanelProps) {
  return (
    <div style={{
      width: 220,
      flexShrink: 0,
      height: "100%",
      borderLeft: '1px solid var(--sv-border)',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--sv-brand)',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 14px 10px',
        borderBottom: '1px solid var(--sv-border)',
        flexShrink: 0,
      }}>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--sv-text-3)', margin: 0 }}>
          Activity
        </p>
      </div>

      <div className="sv-scroll" style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
            <i className="ti ti-loader-2 animate-spin" style={{ fontSize: 18, color: 'var(--sv-text-4)' }} />
          </div>
        ) : activity.length === 0 ? (
          <div style={{ padding: '24px 14px', textAlign: 'center' }}>
            <i className="ti ti-history" style={{ fontSize: 24, color: 'var(--sv-text-4)', display: 'block', marginBottom: 6 }} />
            <p style={{ fontSize: 12, color: 'var(--sv-text-4)', margin: 0 }}>No activity yet</p>
          </div>
        ) : (
          activity.map((entry, i) => (
            <div key={entry.id} style={{
              display: 'flex', gap: 10, padding: '8px 14px',
              borderBottom: i < activity.length - 1 ? '1px solid var(--sv-border)' : 'none',
            }}>
              {/* Icon */}
              <div style={{
                width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--sv-surface)',
              }}>
                <i
                  className={`ti ${EVENT_ICONS[entry.event] ?? 'ti-activity'}`}
                  style={{ fontSize: 12, color: 'var(--sv-accent)' }}
                />
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, color: 'var(--sv-text)', margin: 0, lineHeight: 1.4 }}>
                  <span style={{ fontWeight: 500 }}>{entry.username}</span>
                  {' '}
                  <span style={{ color: 'var(--sv-text-3)' }}>{EVENT_LABELS[entry.event] ?? entry.event}</span>
                </p>
                <p style={{ fontSize: 11, color: 'var(--sv-text-4)', margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {relTime(entry.created_at)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}