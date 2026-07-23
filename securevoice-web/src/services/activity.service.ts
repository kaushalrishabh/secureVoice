import { apiFetch } from '../lib/api';

export type ActivityEvent =
  | 'note_created'
  | 'note_updated'
  | 'collaborator_joined'
  | 'block_added'
  | 'block_edited'
  | 'block_deleted';

export interface ActivityEntry {
  id: string;
  user_id: string;
  username: string;
  event: ActivityEvent;
  block_id: string | null;
  created_at: string;
}

export async function fetchActivity(
  noteId: string,
  options: { limit?: number; before?: string } = {},
): Promise<ActivityEntry[]> {
  const params = new URLSearchParams();
  if (options.limit)  params.set('limit',  String(options.limit));
  if (options.before) params.set('before', options.before);
  const qs = params.toString() ? `?${params}` : '';
  const { activity } = await apiFetch<{ activity: ActivityEntry[] }>(
    `/api/notes/${noteId}/activity${qs}`,
  );
  return activity;
}