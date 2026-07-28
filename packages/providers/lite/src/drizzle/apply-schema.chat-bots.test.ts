import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { migrateChatBotsSchemaForTest } from './apply-schema.js';

function createLegacyChatBotsDb(): Database.Database {
  const sqlite = new Database(':memory:');
  sqlite.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      created_at INTEGER NOT NULL
    );
    INSERT INTO users (id, email, password_hash, role, created_at)
    VALUES ('user-1', 'u@example.com', 'hash', 'admin', 1);

    CREATE TABLE chat_bots (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      system_prompt TEXT NOT NULL DEFAULT '',
      rag_template TEXT NOT NULL DEFAULT 'support',
      knowledge_base_ids TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  return sqlite;
}

describe('migrateChatBotsSchema legacy chat_bots rebuild', () => {
  it('rebuilds legacy table so inserts without user_id succeed', () => {
    const sqlite = createLegacyChatBotsDb();
    migrateChatBotsSchemaForTest(sqlite);

    const cols = sqlite.prepare('PRAGMA table_info(chat_bots)').all() as { name: string }[];
    const names = cols.map((c) => c.name);
    expect(names).not.toContain('user_id');
    expect(names).not.toContain('system_prompt');
    expect(names).toContain('owner_user_id');

    const now = Date.now();
    sqlite
      .prepare(
        `INSERT INTO chat_bots (
          id, owner_user_id, name, slug, status, published_version_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`,
      )
      .run('bot-new', 'user-1', 'New Bot', 'new-bot', 'draft', now, now);

    const row = sqlite
      .prepare('SELECT id, owner_user_id, name, slug FROM chat_bots WHERE id = ?')
      .get('bot-new') as { id: string; owner_user_id: string; name: string; slug: string };
    expect(row).toEqual({
      id: 'bot-new',
      owner_user_id: 'user-1',
      name: 'New Bot',
      slug: 'new-bot',
    });
  });

  it('preserves existing legacy rows after rebuild', () => {
    const sqlite = createLegacyChatBotsDb();
    const now = Date.now();
    sqlite
      .prepare(
        `INSERT INTO chat_bots (
          id, user_id, name, description, system_prompt, rag_template, knowledge_base_ids,
          created_at, updated_at
        ) VALUES (?, ?, ?, '', 'hello', 'support', '[]', ?, ?)`,
      )
      .run('bot-old', 'user-1', 'Legacy Bot', now, now);

    migrateChatBotsSchemaForTest(sqlite);

    const row = sqlite
      .prepare('SELECT id, owner_user_id, name, slug, status FROM chat_bots WHERE id = ?')
      .get('bot-old') as {
      id: string;
      owner_user_id: string;
      name: string;
      slug: string;
      status: string;
    };
    expect(row.id).toBe('bot-old');
    expect(row.owner_user_id).toBe('user-1');
    expect(row.name).toBe('Legacy Bot');
    expect(row.slug).toBeTruthy();
    expect(row.status).toBe('draft');
  });
});
