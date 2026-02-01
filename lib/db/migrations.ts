import db from './client';

export function runMigrations(): void {
  db.exec(`
    -- User-configured paths to config files
    CREATE TABLE IF NOT EXISTS config_paths (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id TEXT NOT NULL UNIQUE,
      path TEXT NOT NULL,
      enabled BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Parsed shortcuts (cache layer)
    CREATE TABLE IF NOT EXISTS shortcuts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id TEXT NOT NULL,
      title TEXT NOT NULL,
      keys TEXT NOT NULL,
      description TEXT,
      source_file TEXT NOT NULL,
      source_line INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (app_id) REFERENCES config_paths(app_id)
    );

    -- AI chat history
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- User preferences
    CREATE TABLE IF NOT EXISTS user_preferences (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Audit log for AI changes
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      target_file TEXT NOT NULL,
      diff TEXT,
      ai_request TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Create indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_shortcuts_app_id ON shortcuts(app_id);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
  `);
}

export function resetDatabase(): void {
  db.exec(`
    DROP TABLE IF EXISTS shortcuts;
    DROP TABLE IF EXISTS chat_messages;
    DROP TABLE IF EXISTS user_preferences;
    DROP TABLE IF EXISTS audit_log;
    DROP TABLE IF EXISTS config_paths;
  `);
  runMigrations();
}
