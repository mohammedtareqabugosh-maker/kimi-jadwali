import { useMemo, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Modal } from '../components/Modal'
import { AlertTriangle, CalendarPlus, Search } from 'lucide-react'
import type { AppData, Task } from '../types'
import { DAYS } from '../types'
import { findAvailableGaps, findConflicts, formatDuration, formatTime, isCompleted } from '../lib/time'
import { DayStrip } from '../components/DayStrip'
import { TaskList } from '../components/TaskList'

interface SchedulePageProps {
  data: AppData
  selectedDay: number
  selectedDate: Date
  onSelectDay: (day: number) => void
  onResetDay: () => void
  onAdd: (quick?: boolean) => void
  onEdit: (task: Task) => void
  onDuplicate: (task: Task) => void
  onDelete: (task: Task) => void
  onToggle: (task: Task) => void
}

export function SchedulePage({ data, selectedDay, selectedDate, onSelectDay, onResetDay, onAdd, onEdit, onDuplicate, onDelete, onToggle }: SchedulePageProps) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'remaining' | 'completed'>('all')
  const [confirmReset, setConfirmReset] = useState(false)
  const tasks = useMemo(() => data.tasks.filter((task) => {
    if (task.day !== selectedDay) return false
    if (search && !`${task.title} ${task.notes}`.toLowerCase().includes(search.trim().toLowerCase())) return false
    const completed = isCompleted(data.completions, selectedDate, task.id)
    return filter === 'all' || (filter === 'completed' ? completed : !completed)
  }), [data.tasks, data.completions, selectedDay, selectedDate, search, filter])
  const dayTasks = data.tasks.filter((task) => task.day === selectedDay)
  const conflictCount = dayTasks.reduce((sum, task) => sum + findConflicts(dayTasks, task).length, 0) / 2
  const freeSlots = findAvailableGaps(dayTasks, selectedDay, 420, 1380).filter(([start, end]) => end - start >= 15)

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div><span className="section-kicker">أسبوعك، بالتفصيل</span><h1>الجدول الأسبوعي</h1><p>عدّل يومًا واحدًا أو كرّر مهمة في أيام عدة. كل تغيير تحت سيطرتك.</p></div>
        <div className="heading-actions"><button type="button" className="secondary-button" onClick={() => setConfirmReset(true)}><RotateCcw size={17} /> إعادة ضبط الإنجاز</button><button type="button" className="primary-button" onClick={() => onAdd(false)}><CalendarPlus size={19} /> مهمة مفصلة</button></div>
      </section>
      <DayStrip selectedDay={selectedDay} onSelect={onSelectDay} today={new Date()} />
      <section className="content-section"><div className="section-heading"><div><h2>الأوقات المتاحة</h2><p>الفترات الخالية من المهام المسجلة بين 7 صباحًا و11 مساءً.</p></div><span className="tag-pill">{freeSlots.length} فترات</span></div>{freeSlots.length ? <div className="secondary-stats">{freeSlots.map(([start,end]) => <article key={`${start}-${end}`}><CalendarPlus size={18}/><div><strong>{formatTime(start)} – {formatTime(end)}</strong><span>{formatDuration(end-start)} متاحة</span></div></article>)}</div> : <p className="micro-note">لا توجد فترات خالية مدتها 15 دقيقة أو أكثر في هذا اليوم.</p>}</section>
      {conflictCount > 0 && <div className="inline-alert"><AlertTriangle size={20} /><p>يوجد {conflictCount} تداخل في {DAYS[selectedDay]}. لم نغيّر أي مهمة تلقائيًا؛ افتح المهمة لمراجعة وقتها.</p></div>}
      {confirmReset && <Modal title="إعادة ضبط إنجازات اليوم" onClose={() => setConfirmReset(false)}><div className="delete-confirm"><p>هل تريد إلغاء علامات الإنجاز لهذا اليوم فقط؟</p><span>لن تتغير المهام أو مواعيدها أو إنجازات الأيام الأخرى.</span><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setConfirmReset(false)}>إلغاء</button><button type="button" className="primary-button" onClick={() => { onResetDay(); setConfirmReset(false) }}>تأكيد إعادة الضبط</button></div></div></Modal>}
      <section className="content-section">
        <div className="schedule-tools">
          <label className="search-field"><Search size={19} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث في مهام هذا اليوم" aria-label="البحث في المهام" /></label>
          <div className="segmented-control" aria-label="تصفية المهام">
            <button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>الكل</button>
            <button type="button" className={filter === 'remaining' ? 'active' : ''} onClick={() => setFilter('remaining')}>المتبقية</button>
            <button type="button" className={filter === 'completed' ? 'active' : ''} onClick={() => setFilter('completed')}>المنجزة</button>
          </div>
        </div>
        <div className="section-heading"><div><h2>{DAYS[selectedDay]}</h2><p>{tasks.length} مهمة ظاهرة · مرتبة حسب وقت البداية</p></div></div>
        <TaskList tasks={tasks} allTasks={data.tasks} selectedDate={selectedDate} completions={data.completions} onToggle={onToggle} onEdit={onEdit} onDuplicate={onDuplicate} onDelete={onDelete} emptyAction={() => onAdd(false)} />
      </section>
    </div>
  )
}
