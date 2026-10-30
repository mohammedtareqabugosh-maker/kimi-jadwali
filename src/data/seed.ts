import type { AppData } from '../types'

// النسخة الفارغة: لا توجد مهام ولا أهداف مبدئية. يضيف المستخدم جدوله بنفسه.
export function createSeedData(): AppData {
  const now = new Date().toISOString()
  return {
    schemaVersion: 1,
    tasks: [],
    goals: [],
    notes: [],
    completions: {},
    settings: { displayName: '', streakTarget: 70, theme: 'light' },
    createdAt: now,
    updatedAt: now,
  }
}
