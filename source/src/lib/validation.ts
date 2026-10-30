import type { AppData, Task, TaskType } from '../types'
import { validateTimes } from './time'

const TASK_TYPES = new Set<TaskType>(['university', 'online', 'work', 'study', 'meal', 'sleep', 'rest', 'sport', 'personal', 'other'])

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

export function validateBackup(value: unknown): AppData {
  assert(value && typeof value === 'object', 'ملف النسخة الاحتياطية ليس كائن JSON صالحًا.')
  const data = value as Partial<AppData>
  assert(Array.isArray(data.tasks) && Array.isArray(data.goals) && Array.isArray(data.notes), 'الملف لا يحتوي على بيانات التطبيق المطلوبة.')
  assert(data.completions && typeof data.completions === 'object' && !Array.isArray(data.completions), 'سجل الإنجاز غير صالح.')
  assert(data.settings && typeof data.settings === 'object', 'إعدادات التطبيق غير صالحة.')
  assert(data.tasks.length <= 10000 && data.goals.length <= 2000 && data.notes.length <= 5000, 'حجم البيانات يتجاوز الحد المسموح.')

  for (const task of data.tasks) {
    assert(task && typeof task.id === 'string' && task.id.length > 0 && typeof task.title === 'string', 'توجد مهمة بلا معرّف أو عنوان.')
    assert(TASK_TYPES.has(task.type), `نوع المهمة «${task.title}» غير معروف.`)
    assert(Number.isInteger(task.day) && task.day >= 0 && task.day <= 6, `يوم المهمة «${task.title}» غير صالح.`)
    assert(!validateTimes(task.start, task.end), `وقت المهمة «${task.title}» غير صالح.`)
  }
  for (const goal of data.goals) {
    assert(goal && typeof goal.id === 'string' && typeof goal.name === 'string', 'توجد بيانات هدف غير صالحة.')
    assert(Number.isFinite(goal.target) && goal.target > 0 && Number.isFinite(goal.current) && goal.current >= 0, `قيم الهدف «${goal.name}» غير صالحة.`)
  }
  for (const note of data.notes) {
    assert(note && typeof note.id === 'string' && typeof note.title === 'string' && typeof note.body === 'string', 'توجد ملاحظة غير صالحة.')
  }

  const now = new Date().toISOString()
  const settings = data.settings as AppData['settings']
  return {
    schemaVersion: Number(data.schemaVersion) >= 4 ? 4 : Number(data.schemaVersion) >= 3 ? 3 : Number(data.schemaVersion) >= 2 ? 2 : 1,
    tasks: data.tasks.map((task: Task) => ({
      ...task,
      title: task.title.trim(),
      notes: typeof task.notes === 'string' ? task.notes : '',
      fixed: Boolean(task.fixed),
      allowSplit: Boolean(task.allowSplit),
      countsTowardsProgress: task.countsTowardsProgress !== false && task.type !== 'sleep' && task.type !== 'rest',
    })),
    goals: data.goals.map((goal) => ({ ...goal, description: goal.description ?? '', unit: goal.unit || 'مرة', status: goal.status ?? 'active', createdAt: goal.createdAt ?? now })),
    notes: data.notes.map((note) => ({ ...note, createdAt: note.createdAt ?? now, updatedAt: note.updatedAt ?? note.createdAt ?? now })),
    completions: Object.fromEntries(Object.entries(data.completions).filter(([, complete]) => complete === true)) as Record<string, boolean>,
    checkins: Array.isArray(data.checkins) ? data.checkins.filter((item): item is string => typeof item === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item)) : [],
    weightHistory: Array.isArray(data.weightHistory) ? data.weightHistory.filter((item) => item && typeof item.id === 'string' && typeof item.date === 'string' && Number.isFinite(item.weight) && item.weight > 0) : [],
    achievements: Array.isArray(data.achievements) ? data.achievements.filter((item) => item && typeof item.id === 'string' && typeof item.title === 'string' && typeof item.date === 'string') : [],
    incidents: Array.isArray(data.incidents) ? data.incidents.filter((item) => item && typeof item.id === 'string' && typeof item.date === 'string' && typeof item.text === 'string') : [],
    settings: {
      displayName: typeof settings.displayName === 'string' ? settings.displayName.slice(0, 80) : '',
      streakTarget: Math.min(100, Math.max(1, Number(settings.streakTarget) || 70)),
      theme: settings.theme === 'dark' ? 'dark' : 'light',
      nutritionGoal: settings.nutritionGoal === 'fast' ? 'fast' : 'balanced',
    },
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : now,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : now,
  }
}
