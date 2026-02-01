import db from './client';
import type {
  ConfigPath,
  Shortcut,
  ChatMessage,
  UserPreference,
  AuditLogEntry,
} from '@/lib/types';

// Config Paths Queries
export const configPaths = {
  getAll: (): ConfigPath[] => {
    return db.prepare('SELECT * FROM config_paths ORDER BY app_id').all() as ConfigPath[];
  },

  getById: (id: number): ConfigPath | undefined => {
    return db.prepare('SELECT * FROM config_paths WHERE id = ?').get(id) as ConfigPath | undefined;
  },

  getByAppId: (appId: string): ConfigPath | undefined => {
    return db.prepare('SELECT * FROM config_paths WHERE app_id = ?').get(appId) as ConfigPath | undefined;
  },

  getEnabled: (): ConfigPath[] => {
    return db.prepare('SELECT * FROM config_paths WHERE enabled = 1 ORDER BY app_id').all() as ConfigPath[];
  },

  create: (appId: string, path: string): ConfigPath => {
    const stmt = db.prepare(
      'INSERT INTO config_paths (app_id, path) VALUES (?, ?) RETURNING *'
    );
    return stmt.get(appId, path) as ConfigPath;
  },

  update: (id: number, data: Partial<Pick<ConfigPath, 'path' | 'enabled'>>): ConfigPath | undefined => {
    const fields: string[] = [];
    const values: (string | boolean | number)[] = [];

    if (data.path !== undefined) {
      fields.push('path = ?');
      values.push(data.path);
    }
    if (data.enabled !== undefined) {
      fields.push('enabled = ?');
      values.push(data.enabled);
    }

    if (fields.length === 0) return configPaths.getById(id);

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const stmt = db.prepare(
      `UPDATE config_paths SET ${fields.join(', ')} WHERE id = ? RETURNING *`
    );
    return stmt.get(...values) as ConfigPath | undefined;
  },

  delete: (id: number): boolean => {
    const result = db.prepare('DELETE FROM config_paths WHERE id = ?').run(id);
    return result.changes > 0;
  },
};

// Shortcuts Queries
export const shortcuts = {
  getAll: (): Shortcut[] => {
    const rows = db.prepare('SELECT * FROM shortcuts ORDER BY app_id, title').all() as Array<Omit<Shortcut, 'keys'> & { keys: string }>;
    return rows.map(row => ({
      ...row,
      keys: JSON.parse(row.keys),
    }));
  },

  getByAppId: (appId: string): Shortcut[] => {
    const rows = db.prepare('SELECT * FROM shortcuts WHERE app_id = ? ORDER BY title').all(appId) as Array<Omit<Shortcut, 'keys'> & { keys: string }>;
    return rows.map(row => ({
      ...row,
      keys: JSON.parse(row.keys),
    }));
  },

  getById: (id: number): Shortcut | undefined => {
    const row = db.prepare('SELECT * FROM shortcuts WHERE id = ?').get(id) as (Omit<Shortcut, 'keys'> & { keys: string }) | undefined;
    if (!row) return undefined;
    return {
      ...row,
      keys: JSON.parse(row.keys),
    };
  },

  search: (query: string): Shortcut[] => {
    const rows = db.prepare(`
      SELECT * FROM shortcuts
      WHERE title LIKE ? OR description LIKE ? OR keys LIKE ?
      ORDER BY app_id, title
    `).all(`%${query}%`, `%${query}%`, `%${query}%`) as Array<Omit<Shortcut, 'keys'> & { keys: string }>;
    return rows.map(row => ({
      ...row,
      keys: JSON.parse(row.keys),
    }));
  },

  create: (data: {
    app_id: string;
    title: string;
    keys: string[];
    description?: string;
    source_file: string;
    source_line?: number;
  }): Shortcut => {
    const stmt = db.prepare(`
      INSERT INTO shortcuts (app_id, title, keys, description, source_file, source_line)
      VALUES (?, ?, ?, ?, ?, ?)
      RETURNING *
    `);
    const row = stmt.get(
      data.app_id,
      data.title,
      JSON.stringify(data.keys),
      data.description || null,
      data.source_file,
      data.source_line || null
    ) as Omit<Shortcut, 'keys'> & { keys: string };
    return {
      ...row,
      keys: JSON.parse(row.keys),
    };
  },

  update: (id: number, data: Partial<{
    title: string;
    keys: string[];
    description: string;
    source_line: number;
  }>): Shortcut | undefined => {
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (data.title !== undefined) {
      fields.push('title = ?');
      values.push(data.title);
    }
    if (data.keys !== undefined) {
      fields.push('keys = ?');
      values.push(JSON.stringify(data.keys));
    }
    if (data.description !== undefined) {
      fields.push('description = ?');
      values.push(data.description);
    }
    if (data.source_line !== undefined) {
      fields.push('source_line = ?');
      values.push(data.source_line);
    }

    if (fields.length === 0) return shortcuts.getById(id);

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const stmt = db.prepare(
      `UPDATE shortcuts SET ${fields.join(', ')} WHERE id = ? RETURNING *`
    );
    const row = stmt.get(...values) as (Omit<Shortcut, 'keys'> & { keys: string }) | undefined;
    if (!row) return undefined;
    return {
      ...row,
      keys: JSON.parse(row.keys),
    };
  },

  delete: (id: number): boolean => {
    const result = db.prepare('DELETE FROM shortcuts WHERE id = ?').run(id);
    return result.changes > 0;
  },

  deleteByAppId: (appId: string): number => {
    const result = db.prepare('DELETE FROM shortcuts WHERE app_id = ?').run(appId);
    return result.changes;
  },

  bulkCreate: (shortcuts: Array<{
    app_id: string;
    title: string;
    keys: string[];
    description?: string;
    source_file: string;
    source_line?: number;
  }>): void => {
    const stmt = db.prepare(`
      INSERT INTO shortcuts (app_id, title, keys, description, source_file, source_line)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((items: typeof shortcuts) => {
      for (const item of items) {
        stmt.run(
          item.app_id,
          item.title,
          JSON.stringify(item.keys),
          item.description || null,
          item.source_file,
          item.source_line || null
        );
      }
    });

    insertMany(shortcuts);
  },
};

// Chat Messages Queries
export const chatMessages = {
  getBySession: (sessionId: string): ChatMessage[] => {
    return db.prepare(
      'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at'
    ).all(sessionId) as ChatMessage[];
  },

  create: (sessionId: string, role: 'user' | 'assistant', content: string): ChatMessage => {
    const stmt = db.prepare(`
      INSERT INTO chat_messages (session_id, role, content)
      VALUES (?, ?, ?)
      RETURNING *
    `);
    return stmt.get(sessionId, role, content) as ChatMessage;
  },

  deleteBySession: (sessionId: string): number => {
    const result = db.prepare('DELETE FROM chat_messages WHERE session_id = ?').run(sessionId);
    return result.changes;
  },
};

// User Preferences Queries
export const userPreferences = {
  get: (key: string): string | undefined => {
    const row = db.prepare('SELECT value FROM user_preferences WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value;
  },

  getAll: (): UserPreference[] => {
    return db.prepare('SELECT * FROM user_preferences ORDER BY key').all() as UserPreference[];
  },

  set: (key: string, value: string): void => {
    db.prepare(`
      INSERT INTO user_preferences (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP
    `).run(key, value, value);
  },

  delete: (key: string): boolean => {
    const result = db.prepare('DELETE FROM user_preferences WHERE key = ?').run(key);
    return result.changes > 0;
  },
};

// Audit Log Queries
export const auditLog = {
  getAll: (limit = 100): AuditLogEntry[] => {
    return db.prepare(
      'SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?'
    ).all(limit) as AuditLogEntry[];
  },

  getByFile: (targetFile: string): AuditLogEntry[] => {
    return db.prepare(
      'SELECT * FROM audit_log WHERE target_file = ? ORDER BY created_at DESC'
    ).all(targetFile) as AuditLogEntry[];
  },

  create: (data: {
    action: string;
    target_file: string;
    diff?: string;
    ai_request?: string;
  }): AuditLogEntry => {
    const stmt = db.prepare(`
      INSERT INTO audit_log (action, target_file, diff, ai_request)
      VALUES (?, ?, ?, ?)
      RETURNING *
    `);
    return stmt.get(
      data.action,
      data.target_file,
      data.diff || null,
      data.ai_request || null
    ) as AuditLogEntry;
  },
};
