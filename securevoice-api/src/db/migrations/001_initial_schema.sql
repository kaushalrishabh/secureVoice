-- =============================================================================
-- SecureVoice — Initial Database Schema
-- Migration: 001_initial_schema.sql
--
-- Architecture notes:
--   • All note content is encrypted client-side (AES-256-GCM) before reaching
--     the server. The server stores only ciphertext blobs — never plaintext.
--   • Every note has its own note_DEK (per-note Data Encryption Key).
--     Private notes: note_DEK wrapped by user_DEK (symmetric).
--     Shared notes:  note_DEK wrapped by RSA public key (asymmetric).
--   • User DEK/KEK flow follows the production BFSI architecture:
--     Client_Hash → PBKDF2(Client_Hash, dek_salt) → KEK → unwrap user_DEK
--   • auth_salt: Argon2id salt, server-generated at registration.
--   • dek_salt:  PBKDF2 salt, client-generated at registration.
--   • Sharing never exposes any user's master DEK — only the isolated note_DEK
--     is transferred, wrapped in the recipient's RSA public key.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TABLE: users
-- Stores auth material and crypto metadata per user.
-- The server never holds a plaintext DEK or KEK at any point.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id               CHAR(36)      NOT NULL,
  email            VARCHAR(255)  NOT NULL,
  username         VARCHAR(50)   NOT NULL,
  first_name        VARCHAR(100)  NOT NULL,
  last_name        VARCHAR(100)  NOT NULL,
  password_hash    TEXT          NOT NULL,
  auth_salt        TEXT          NOT NULL,
  dek_salt         TEXT          NOT NULL,
  dek              TEXT          NOT NULL,
  public_key       TEXT          NOT NULL,
  private_key_enc  TEXT          NOT NULL,
  created_at       TIMESTAMP     NOT NULL   DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email    (email),
  UNIQUE KEY uq_users_username (username)
);

-- -----------------------------------------------------------------------------
-- TABLE: folders
-- Plaintext metadata for note organisation. Folder names are not sensitive —
-- encrypting them would prevent server-side filtering without benefit.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS folders (
  id         CHAR(36)      NOT NULL,
  user_id    CHAR(36)      NOT NULL,
  name       VARCHAR(100)  NOT NULL,
  color      VARCHAR(7)    NOT NULL  DEFAULT '#4F46E5',
  created_at TIMESTAMP     NOT NULL  DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  CONSTRAINT fk_folders_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- TABLE: notes
-- Unified table for private and shared notes.
-- type = 'private' → one row in note_keys (owner only).
-- type = 'shared'  → multiple rows in note_keys (one per collaborator).
--
-- content_cipher stores the AES-256-GCM encrypted JSON blob: { title, content }
-- Title and body are encrypted together — no separate title column needed.
-- The note list decrypts content_cipher client-side to extract the title.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notes (
  id              CHAR(36)               NOT NULL,
  owner_id        CHAR(36)               NOT NULL,
  folder_id       CHAR(36)                   NULL,
  type            ENUM('private','shared') NOT NULL DEFAULT 'private',
  content_iv      TEXT                       NULL,
  content_cipher  TEXT                       NULL,
  pinned          TINYINT(1)             NOT NULL DEFAULT 0,
  created_at      TIMESTAMP             NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP             NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_notes_owner
    FOREIGN KEY (owner_id)  REFERENCES users   (id) ON DELETE CASCADE,
  CONSTRAINT fk_notes_folder
    FOREIGN KEY (folder_id) REFERENCES folders (id) ON DELETE SET NULL
);

-- -----------------------------------------------------------------------------
-- TABLE: note_keys
-- Stores each user's encrypted copy of a note's DEK.
-- This is the core of the sharing model.
--
-- Private note lifecycle:
--   CREATE  → 1 row inserted (owner, enc_method='symmetric')
--   READ    → client fetches enc_note_dek, decrypts with user_DEK → note_DEK
--
-- Shared note lifecycle:
--   INVITE  → inviter wraps note_DEK with invitee's RSA public key → stored in invites
--   ACCEPT  → invitee decrypts via RSA, re-wraps with user_DEK → row inserted here
--
-- enc_method tells the client HOW to unwrap enc_note_dek:
--   'symmetric'  → AES-256-GCM-decrypt(enc_note_dek, user_DEK)
--   'asymmetric' → RSA-OAEP-decrypt(enc_note_dek, RSA_private_key)
--                  (only used transiently before re-wrapping to symmetric on accept)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS note_keys (
  note_id      CHAR(36)                          NOT NULL,
  user_id      CHAR(36)                          NOT NULL,
  enc_note_dek TEXT                              NOT NULL,
  enc_method   ENUM('symmetric','asymmetric')    NOT NULL DEFAULT 'symmetric',
  role         ENUM('owner','editor')            NOT NULL DEFAULT 'owner',
  created_at   TIMESTAMP                         NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (note_id, user_id),
  CONSTRAINT fk_note_keys_note
    FOREIGN KEY (note_id) REFERENCES notes (id) ON DELETE CASCADE,
  CONSTRAINT fk_note_keys_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- TABLE: note_blocks
-- Append-only contributions to shared notes.
-- Each block belongs to one author and holds one unit of encrypted content
-- (a typed paragraph or a voice transcript).
--
-- content_cipher = AES-256-GCM( text, note_DEK ) — same note_DEK as the parent note.
-- ciphertext — the WHO is visible, the WHAT is private.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS note_blocks (
  id             CHAR(36)               NOT NULL,
  note_id        CHAR(36)               NOT NULL,
  author_id      CHAR(36)               NOT NULL,
  content_iv     TEXT                   NOT NULL,
  content_cipher TEXT                   NOT NULL,
  created_at     TIMESTAMP              NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_note_blocks_note
    FOREIGN KEY (note_id)   REFERENCES notes (id) ON DELETE CASCADE,
  CONSTRAINT fk_note_blocks_author
    FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- TABLE: invites
-- Manages pending sharing invitations.
--
-- enc_note_dek: the note's DEK, already encrypted by the inviter in their browser
-- using the INVITEE's RSA public key. The server stores this blob without being
-- able to read it — only the invitee's RSA private key can unwrap it.
--
-- Flow:
--   1. Inviter decrypts note_DEK in browser
--   2. Inviter fetches invitee's public_key from /users
--   3. Inviter RSA-OAEP encrypts note_DEK → enc_note_dek
--   4. POST /notes/:id/invite → row inserted here
--   5. Invitee accepts → enc_note_dek moved to note_keys, invite marked 'accepted'
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invites (
  id              CHAR(36)                            NOT NULL,
  note_id         CHAR(36)                            NOT NULL,
  inviter_id      CHAR(36)                            NOT NULL,
  invitee_email   VARCHAR(255)                        NOT NULL,
  token           VARCHAR(64)                         NOT NULL,
  enc_note_dek    TEXT                                    NULL,
  status          ENUM('pending','accepted','expired') NOT NULL DEFAULT 'pending',
  expires_at      TIMESTAMP                            NOT NULL,
  created_at      TIMESTAMP                            NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_invites_token (token),
  CONSTRAINT fk_invites_note
    FOREIGN KEY (note_id)    REFERENCES notes (id) ON DELETE CASCADE,
  CONSTRAINT fk_invites_inviter
    FOREIGN KEY (inviter_id) REFERENCES users (id) ON DELETE CASCADE
);