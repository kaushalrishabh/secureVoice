-- =============================================================================
-- SecureVoice — Migration 002: Per-user folder & pin preferences
--
-- Problem: folder_id and pinned live on the notes table — one value shared
-- across all collaborators. When User A pins or moves a shared note, it
-- overwrites User B's preference.
--
-- Fix: move both columns into note_keys, which already has one row per
-- (note_id, user_id). Each user now has their own independent folder/pin state.
-- =============================================================================

-- Step 1: Add the new per-user columns to note_keys
ALTER TABLE note_keys
  ADD COLUMN folder_id  CHAR(36)   NULL DEFAULT NULL,
  ADD COLUMN pinned     TINYINT(1) NOT NULL DEFAULT 0;

-- Step 2: Migrate existing data — copy the owner's current folder/pin into
-- their note_keys row so no data is lost on upgrade
UPDATE note_keys nk
JOIN notes n ON n.id = nk.note_id AND n.owner_id = nk.user_id
SET nk.folder_id = n.folder_id,
    nk.pinned    = n.pinned;

-- Step 3: Add FK on note_keys.folder_id so orphaned folder refs are nulled
-- (mirrors the same behaviour the old notes.folder_id FK had)
ALTER TABLE note_keys
  ADD CONSTRAINT fk_note_keys_folder
    FOREIGN KEY (folder_id) REFERENCES folders (id)
    ON DELETE SET NULL;

-- Step 4: Drop the now-redundant columns from notes
ALTER TABLE notes DROP FOREIGN KEY fk_notes_folder;
ALTER TABLE notes DROP COLUMN folder_id;
ALTER TABLE notes DROP COLUMN pinned;