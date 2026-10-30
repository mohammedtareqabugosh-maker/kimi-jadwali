import type { AppData, Goal, Note, Task, TaskType } from '../types'
import { createId } from './id'

export interface CommandResult { handled: boolean; changed: boolean; data: AppData; reply: string }
const DAYS: Array<{ index: number; names: string[] }> = [
  { index: 0, names: ['الأحد', 'احد', 'الاحد'] },
  { index: 1, names: ['الاثنين', 'الإثنين', 'اثنين'] },
  { index: 2, names: ['الثلاثاء', 'ثلاثاء'] },
  { index: 3, names: ['الأربعاء', 'الاربعاء', 'اربعاء'] },
  { index: 4, names: ['الخميس', 'خميس'] },
  { index: 5, names: ['الجمعة', 'جمعة'] },
  { index: 6, names: ['السبت', 'سبت'] },
]
const normalize = (value: string) => value.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[إأآ]/g, 'ا').replace(/ة/g, 'ه').replace(/[ًٌٍَُِّْ]/g, '').toLowerCase().trim()
const dayFrom = (value: string, fallback: number) => DAYS.find(d => d.names.some(name => normalize(value).includes(normalize(name))))?.index ?? fallback
const minutes = (value: string): number | null => {
  const match = value.match(/(\d{1,2})(?::(\d{2}))?\s*(صباحا|مساء|ص|م|am|pm)?/i)
  if (!match) return null
  let hour = Number(match[1]); const minute = Number(match[2] || 0); const suffix = normalize(match[3] || '')
  if (hour > 23 || minute > 59) return null
  if (['م', 'مساء', 'pm'].includes(suffix) && hour < 12) hour += 12
  if (['ص', 'صباحا', 'am'].includes(suffix) && hour === 12) hour = 0
  return hour * 60 + minute
}
const timeLabel = (value: number) => `${String(Math.floor(value / 60) % 24).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
const result = (handled: boolean, changed: boolean, data: AppData, reply: string): CommandResult => ({ handled, changed, data, reply })

export function executeAssistantCommand(raw: string, current: AppData, selectedDay: number): CommandResult {
  const text = raw.trim()
  const normalized = normalize(text)
  const day = dayFrom(text, selectedDay)
  const deleteVerb = /^(احذف|حذف|امسح|الغ|شيل|ازل|ازيل)\s+/
  const addVerb = /^(ضيف|اضف|اضافة|حط|سجل|انشئ|اعمل)\s+/
  const stripVerb = (value: string) => value.replace(/^(احذف|حذف|امسح|الغ|شيل|ازل|ازيل|ضيف|أضف|اضف|إضف|اضافة|حط|سجل|انشئ|اعمل)\s+/, '').trim()

  if (deleteVerb.test(normalized)) {
    let target = stripVerb(normalized).replace(/^(المهمه|مهمه|الوجبه|وجبه|الهدف|هدف|الملاحظه|ملاحظه)\s+/, '').trim()
    const daySpecified = DAYS.some(d => d.names.some(name => normalized.includes(normalize(name))))
    target = target.replace(/\s+(يوم\s*)?(الاحد|الاثنين|الثلاثاء|الاربعاء|الخميس|الجمعة|السبت).*$/, '').trim()
    if (!target) return result(true, false, current, 'اكتب اسم الشيء الذي تريد حذفه، مثل: احذف محاضرة البرمجة يوم الأحد.')
    const tasks = current.tasks.filter(task => (!daySpecified || task.day === day) && normalize(task.title).includes(target))
    if (tasks.length === 1) {
      const found = tasks[0]
      const completions = Object.fromEntries(Object.entries(current.completions).filter(([key]) => !key.includes(found.id)))
      return result(true, true, { ...current, tasks: current.tasks.filter(task => task.id !== found.id), completions, updatedAt: new Date().toISOString() }, `تم حذف "${found.title}" من يوم ${DAYS[found.day].names[0]}.`)
    }
    if (tasks.length > 1) return result(true, false, current, `وجدت أكثر من مهمة مطابقة. حدّد اليوم أو الاسم: ${tasks.slice(0, 5).map(task => `${task.title} (${DAYS[task.day].names[0]})`).join('، ')}.`)
    const goals = current.goals.filter(goal => normalize(goal.name).includes(target))
    if (goals.length === 1) {
      const goal = goals[0]
      return result(true, true, { ...current, goals: current.goals.filter(item => item.id !== goal.id), tasks: current.tasks.map(task => task.goalId === goal.id ? { ...task, goalId: undefined } : task), updatedAt: new Date().toISOString() }, `تم حذف الهدف "${goal.name}".`)
    }
    const notes = current.notes.filter(note => normalize(note.title).includes(target))
    if (notes.length === 1) return result(true, true, { ...current, notes: current.notes.filter(note => note.id !== notes[0].id), updatedAt: new Date().toISOString() }, `تم حذف الملاحظة "${notes[0].title}".`)
    if (goals.length > 1 || notes.length > 1) return result(true, false, current, 'وجدت أكثر من عنصر مطابق. اكتب الاسم كاملًا لتحديد المطلوب.')
    return result(true, false, current, `ما لقيت مهمة أو هدفًا أو ملاحظة باسم "${target}".`)
  }

  if (addVerb.test(normalized) && /هدف/.test(normalized)) {
    const name = stripVerb(text).replace(/^(هدف جديد|هدف)\s*/, '').trim()
    if (!name) return result(true, false, current, 'اكتب اسم الهدف، مثل: أضف هدف قراءة 10 صفحات يوميًا.')
    const goal: Goal = { id: createId('goal'), name, description: '', target: 1, current: 0, unit: 'مرة', status: 'active', createdAt: new Date().toISOString() }
    return result(true, true, { ...current, goals: [...current.goals, goal], updatedAt: new Date().toISOString() }, `تمت إضافة الهدف "${name}". يمكنك تعديل قيمته من قسم الأهداف.`)
  }

  if (addVerb.test(normalized) && /ملاحظة|ملاحظه/.test(normalized)) {
    const body = stripVerb(text).replace(/^(ملاحظة جديدة|ملاحظة|ملاحظه)\s*/, '').trim()
    if (!body) return result(true, false, current, 'اكتب نص الملاحظة بعد عبارة أضف ملاحظة.')
    const now = new Date().toISOString()
    const note: Note = { id: createId('note'), title: body.slice(0, 80), body, createdAt: now, updatedAt: now, day }
    return result(true, true, { ...current, notes: [...current.notes, note], updatedAt: now }, 'تمت إضافة الملاحظة وحفظها.')
  }

  if (addVerb.test(normalized) && /(مهمه|موعد|محاضره|مذاكره|دراسه|غداء|عشاء|فطور|افطار|رياضه|شغل|عمل|نوم|راحه|وجبه)/.test(normalized)) {
    const range = text.match(/(?:من\s*)?(\d{1,2}(?::\d{2})?\s*(?:صباحا|مساء|ص|م|am|pm)?)\s*(?:الى|إلى|لحد|حتى|-)\s*(\d{1,2}(?::\d{2})?\s*(?:صباحا|مساء|ص|م|am|pm)?)/i)
    let start = range ? minutes(range[1]) : null
    let end = range ? minutes(range[2]) : null
    if (range && end !== null && start !== null && end <= start && !/(مساء|م|pm)/i.test(range[1]) && /(مساء|م|pm)/i.test(range[2]) && start < 12 * 60) end += 12 * 60
    let title = stripVerb(text).replace(/^(مهمة|موعد)\s*/, '')
    title = title.replace(/\s*(?:يوم\s*)?(الأحد|الاحد|الاثنين|الإثنين|الثلاثاء|الأربعاء|الاربعاء|الخميس|الجمعة|السبت)\s*/gi, ' ')
      .replace(/\s*(?:من\s*)?\d{1,2}(?::\d{2})?\s*(?:صباحا|مساء|ص|م|am|pm)?\s*(?:الى|إلى|لحد|حتى|-)\s*\d{1,2}(?::\d{2})?\s*(?:صباحا|مساء|ص|م|am|pm)?/gi, ' ')
      .replace(/\s+/g, ' ').trim()
    title = title.replace(/^(مهمة|موعد)\s*/, '').trim()
    if (!title) return result(true, false, current, 'اكتب اسم المهمة. مثال: أضف مذاكرة البرمجة يوم الأحد من 19:00 إلى 20:00.')
    const type: TaskType = /(غداء|عشاء|فطور|افطار|وجبه)/.test(normalized) ? 'meal' : /(محاضره|جامعه)/.test(normalized) ? 'university' : /(مذاكره|دراسه)/.test(normalized) ? 'study' : /رياضه/.test(normalized) ? 'sport' : /(عمل|شغل)/.test(normalized) ? 'work' : /نوم/.test(normalized) ? 'sleep' : /راحه/.test(normalized) ? 'rest' : 'personal'
    if (start === null || end === null || end <= start) {
      if (range) return result(true, false, current, 'وقت المهمة غير واضح. استخدم مثلًا: أضف مذاكرة البرمجة يوم الأحد من 19:00 إلى 20:00.')
      const duration = type === 'study' ? 60 : 30
      let candidate = 9 * 60
      while (candidate + duration <= 22 * 60) {
        const busy = current.tasks.some(item => item.day === day && candidate < (minutes(item.end) ?? 0) && candidate + duration > (minutes(item.start) ?? 0))
        if (!busy) { start = candidate; end = candidate + duration; break }
        candidate += 30
      }
      if (start === null || end === null) return result(true, false, current, 'لم أجد فترة فارغة مناسبة في هذا اليوم. اكتب الوقت الذي تريده لأضيف المهمة.')
    }
    const task: Task = { id: createId('task'), title, type, day, start: timeLabel(start), end: timeLabel(end), notes: '', fixed: ['university', 'work', 'online'].includes(type), allowSplit: ['study', 'personal', 'other'].includes(type), countsTowardsProgress: !['sleep', 'rest'].includes(type) }
    const collision = current.tasks.find(item => item.day === day && start < (minutes(item.end) ?? 0) && end! > (minutes(item.start) ?? 0))
    if (collision) return result(true, false, current, `لم أضفها لأن وقتها يتعارض مع "${collision.title}" (${collision.start}–${collision.end}). اختر وقتًا آخر.`)
    return result(true, true, { ...current, tasks: [...current.tasks, task], updatedAt: new Date().toISOString() }, `تمت إضافة "${title}" يوم ${DAYS[day].names[0]} من ${task.start} إلى ${task.end}.`)
  }
  return result(false, false, current, '')
}
