import { eq } from 'drizzle-orm';
import type { LiteDatabase } from './db.js';
import { userPreferences } from './drizzle/schema.js';

export interface UserPreferencesRow {
  locale: string;
  themePreference: string;
  themeId: string;
  executionEnvironment: string;
}

const defaults: UserPreferencesRow = {
  locale: 'zh-CN',
  themePreference: 'system',
  themeId: 'dark',
  executionEnvironment: 'test',
};

export function createLitePreferencesRepository(db: LiteDatabase) {
  return {
    async get(userId: string): Promise<UserPreferencesRow> {
      const row = await db.query.userPreferences.findFirst({
        where: eq(userPreferences.userId, userId),
      });
      if (!row) return { ...defaults };
      return {
        locale: row.locale,
        themePreference: row.themePreference,
        themeId: row.themeId,
        executionEnvironment: row.executionEnvironment,
      };
    },

    async patch(
      userId: string,
      patch: Partial<UserPreferencesRow>,
    ): Promise<UserPreferencesRow> {
      const current = await this.get(userId);
      const next: UserPreferencesRow = {
        locale: patch.locale ?? current.locale,
        themePreference: patch.themePreference ?? current.themePreference,
        themeId: patch.themeId ?? current.themeId,
        executionEnvironment:
          patch.executionEnvironment ?? current.executionEnvironment,
      };
      const now = new Date();
      const existing = await db.query.userPreferences.findFirst({
        where: eq(userPreferences.userId, userId),
      });
      if (existing) {
        await db
          .update(userPreferences)
          .set({
            locale: next.locale,
            themePreference: next.themePreference,
            themeId: next.themeId,
            executionEnvironment: next.executionEnvironment,
            updatedAt: now,
          })
          .where(eq(userPreferences.userId, userId));
      } else {
        await db.insert(userPreferences).values({
          userId,
          locale: next.locale,
          themePreference: next.themePreference,
          themeId: next.themeId,
          executionEnvironment: next.executionEnvironment,
          updatedAt: now,
        });
      }
      return next;
    },
  };
}
