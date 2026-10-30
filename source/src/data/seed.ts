import type { AppData } from '../types'

/** Empty starter data for the public template. Never preload personal tasks. */
export function createSeedData(): AppData {
  const now = new Date().toISOString()
  return {
    schemaVersion: 4,
    tasks: [],
    goals: [],
    notes: [],
    completions: {},
    checkins: [],
    weightHistory: [],
    achievements: [],
    incidents: [],
    settings: { displayName: '', streakTarget: 70, theme: 'light', nutritionGoal: 'balanced' },
    createdAt: now,
    updatedAt: now,
  }
}

/** Alias used by the blank-template storage path. */
export function createBlankSeedData(): AppData {
  return createSeedData()
}
