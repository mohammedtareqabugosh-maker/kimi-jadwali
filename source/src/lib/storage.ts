import { openDB, type IDBPDatabase } from 'idb'
import type { AppData } from '../types'
import { createBlankSeedData, createSeedData } from '../data/seed'
import { validateBackup } from './validation'

const IS_BLANK_TEMPLATE = window.location.pathname.endsWith('/blank.html') || new URLSearchParams(window.location.search).get('template') === 'blank'
const BASE_DB_NAME = 'kimi-jadwali-public-blank-v1'
const STORE_NAME = 'local-data'
const DATA_KEY = 'app-state'
let activeUserId: string | null = null
let databasePromise: Promise<IDBPDatabase> | null = null

function getDatabaseName(): string { return activeUserId ? `${BASE_DB_NAME}-account-${activeUserId}` : BASE_DB_NAME }
function openDataDatabase(name: string): Promise<IDBPDatabase> {
  return openDB(name, 1, { upgrade(database) { if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME) } })
}
function getDatabase(): Promise<IDBPDatabase> {
  if (!databasePromise) databasePromise = openDataDatabase(getDatabaseName())
  return databasePromise
}

/** Select an account-isolated local database. The old local data is copied to the first signed-in account only. */
export async function setStorageUserId(userId: string): Promise<void> {
  if (activeUserId === userId && databasePromise) return
  activeUserId = userId
  databasePromise = null
  const accountDb = await getDatabase()
  const accountData = await accountDb.get(STORE_NAME, DATA_KEY)
  if (accountData) return
  const migrationKey = `nassq-legacy-claimed:${BASE_DB_NAME}`
  if (localStorage.getItem(migrationKey)) return
  const legacyDb = await openDataDatabase(BASE_DB_NAME)
  try {
    const legacyData = await legacyDb.get(STORE_NAME, DATA_KEY)
    if (legacyData) {
      await accountDb.put(STORE_NAME, legacyData, DATA_KEY)
      localStorage.setItem(migrationKey, userId)
    }
  } finally { legacyDb.close() }
}

export async function hasStoredData(): Promise<boolean> {
  const database = await getDatabase()
  return Boolean(await database.get(STORE_NAME, DATA_KEY))
}

export async function loadData(): Promise<AppData> {
  try {
    const database = await getDatabase()
    const stored = await database.get(STORE_NAME, DATA_KEY)
    if (!stored) {
      const seed = IS_BLANK_TEMPLATE ? createBlankSeedData() : createSeedData()
      await database.put(STORE_NAME, seed, DATA_KEY)
      return seed
    }
    const validated = validateBackup(stored)
    if (validated.schemaVersion < 4) {
      // Upgrade the schema marker only. Do not recreate default tasks here:
      // doing so would resurrect tasks the user intentionally deleted.
      const migrated = { ...validated, schemaVersion: 4 }
      await database.put(STORE_NAME, migrated, DATA_KEY)
      return migrated
    }
    return validated
  } catch (error) {
    throw new Error(`تعذر قراءة البيانات المحلية: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`)
  }
}

export async function saveData(data: AppData): Promise<void> {
  try {
    const database = await getDatabase()
    await database.put(STORE_NAME, { ...data, updatedAt: new Date().toISOString() }, DATA_KEY)
    localStorage.setItem('jadwali-theme', data.settings.theme)
  } catch (error) {
    throw new Error(`تعذر حفظ البيانات: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`)
  }
}

export function downloadBackup(data: AppData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `jadwali-backup-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export async function parseBackupFile(file: File): Promise<AppData> {
  if (file.size > 10 * 1024 * 1024) throw new Error('حجم الملف أكبر من 10 ميغابايت.')
  let value: unknown
  try {
    value = JSON.parse(await file.text())
  } catch {
    throw new Error('تعذر قراءة JSON. اختر نسخة احتياطية صادرة من التطبيق.')
  }
  return validateBackup(value)
}
