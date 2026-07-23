-- =============================================================================
-- SecureVoice — Migration 003: Note activity / audit log
--
-- Stores metadata-only audit entries per note. The server never sees plaintext
-- so no content is stored — only who did what and when.
-- Cascades on note delete so no orphaned rows accumulate.
-- =============================================================================

CREATE TABLE IF NOT EXISTS note_activity (
  id         CHAR(36)    NOT NULL,
  note_id    CHAR(36)    NOT NULL,
  user_id    CHAR(36)    NOT NULL,
  username   VARCHAR(50) NOT NULL,
  event      ENUM(
    'note_created',
    'note_updated',
    'collaborator_joined',
    'block_added',
    'block_edited',
    'block_deleted'
  )                      NOT NULL,
  block_id   CHAR(36)        NULL,
  created_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  CONSTRAINT fk_activity_note
    FOREIGN KEY (note_id) REFERENCES notes (id) ON DELETE CASCADE,

  -- Fast retrieval for the timeline query
  INDEX idx_activity_note_created (note_id, created_at DESC)
);