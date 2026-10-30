import { useState } from 'react'
import { CheckCircle2, Flame, Target, Utensils, Plus, Scale, CalendarCheck, Trash2 } from 'lucide-react'
import type { AppData } from '../types'
import { calculatePeriodStats, getStreak } from '../lib/stats'
import { formatDuration, weekDates, dateKey } from '../lib/time'
import { createId } from '../lib/id'

type ProgressPatch = Partial<Pick<AppData, 'checkins' | 'weightHistory' | 'achievements' | 'incidents'>>
export function StatsPage({ data, selectedDate, onProgressChange }: { data: AppData; selectedDate: Date; onProgressChange: (patch: ProgressPatch) => void }) {
  const [period, setPeriod] = useState<'day' | 'week'>('day')
  const [weight, setWeight] = useState('')
  const [achievement, setAchievement] = useState('')
  const [incident, setIncident] = useState('')
  const dates = period === 'day' ? [selectedDate] : weekDates(selectedDate)
  const stats = calculatePeriodStats(data.tasks, data.completions, dates)
  const streak = getStreak(data)
  const achievedGoals = data.goals.filter((goal) => goal.status === 'completed' || goal.current >= goal.target).length
  const todayKey = dateKey(selectedDate)
  const monthKey = todayKey.slice(0, 7)
  const monthCheckins = data.checkins.filter((date) => date.startsWith(monthKey)).length
  const monthWeights = data.weightHistory.filter((record) => record.date.startsWith(monthKey)).sort((a, b) => b.date.localeCompare(a.date))
  const categories = [
    { key: 'work' as const, label: 'العمل' },
    { key: 'university' as const, label: 'الجامعة' },
    { key: 'online' as const, label: 'المحاضرات أونلاين' },
    { key: 'study' as const, label: 'المذاكرة الذاتية' },
  ]
  const maxMinutes = Math.max(1, ...categories.map(({ key }) => stats.categoryMinutes[key].planned))
  const recordCheckin = () => onProgressChange({ checkins: data.checkins.includes(todayKey) ? data.checkins : [...data.checkins, todayKey].sort() })
  const saveWeight = () => {
    const value = Number(weight)
    if (!Number.isFinite(value) || value < 20 || value > 400) return
    const next = data.weightHistory.filter((item) => item.date !== todayKey)
    next.push({ id: createId('weight'), date: todayKey, weight: Math.round(value * 10) / 10 })
    onProgressChange({ weightHistory: next.sort((a, b) => a.date.localeCompare(b.date)) })
    setWeight('')
  }
  const addAchievement = () => {
    const title = achievement.trim()
    if (!title) return
    onProgressChange({ achievements: [...data.achievements, { id: createId('achievement'), title, date: todayKey }] })
    setAchievement('')
  }
  const addIncident = () => {
    const text = incident.trim()
    if (!text) return
    onProgressChange({ incidents: [...data.incidents, { id: createId('incident'), date: todayKey, text }] })
    setIncident('')
  }
  return <div className="page-stack">
    <section className="page-heading"><div><span className="section-kicker">أرقام من جدولك الفعلي</span><h1>الإحصائيات والتقارير</h1><p>تتبع إنجازك اليومي، التزامك، وسجل الوزن والإنجازات الشهرية.</p></div><div className="segmented-control"><button type="button" className={period === 'day' ? 'active' : ''} onClick={() => setPeriod('day')}>اليوم</button><button type="button" className={period === 'week' ? 'active' : ''} onClick={() => setPeriod('week')}>الأسبوع</button></div></section>
    <div className="stats-overview"><article><span>نسبة الإنجاز</span><strong>{stats.percentage}%</strong><small>{stats.completed} مكتملة · {stats.remaining} متبقية</small></article><article><span>الوقت المخطط</span><strong>{formatDuration(stats.plannedMinutes)}</strong><small>للمهام الداخلة في الإنجاز</small></article><article><span>الوقت المشغول</span><strong>{formatDuration(stats.occupiedMinutes)}</strong><small>بعد دمج التداخلات</small></article><article><span>سلسلة الالتزام</span><strong><Flame size={24} /> {streak.current}</strong><small>أفضل سلسلة: {streak.best} يوم</small></article></div>
    <section className="content-section"><div className="section-heading"><div><h2>توزيع الساعات</h2><p>الوقت المنجز تقديري بحسب المهام التي سجلتها كمكتملة.</p></div></div><div className="category-chart">{categories.map(({ key, label }) => { const values = stats.categoryMinutes[key]; return <div className="chart-row" key={key}><div><strong>{label}</strong><span>{formatDuration(values.planned)}</span></div><div className="chart-track" aria-label={`${label}: ${formatDuration(values.planned)} مخطط، ${formatDuration(values.completed)} منجز`}><span className="chart-planned" style={{ width: `${values.planned / maxMinutes * 100}%` }} /><span className="chart-completed" style={{ width: `${values.planned ? values.completed / maxMinutes * 100 : 0}%` }} /></div><small>المنجز: {formatDuration(values.completed)}</small></div>})}</div><div className="chart-legend"><span><i className="planned" /> مخطط</span><span><i className="completed" /> منجز</span></div></section>
    <div className="secondary-stats"><article><CheckCircle2 size={21} /><div><strong>{stats.completed} / {stats.total}</strong><span>المهام المكتملة</span></div></article><article><Utensils size={21} /><div><strong>{stats.mealsTotal ? Math.round(stats.mealsCompleted / stats.mealsTotal * 100) : 0}%</strong><span>الالتزام بالوجبات ({stats.mealsCompleted}/{stats.mealsTotal})</span></div></article><article><Target size={21} /><div><strong>{achievedGoals} / {data.goals.length}</strong><span>الأهداف المكتملة</span></div></article></div>
    <section className="content-section">
      <div className="section-heading"><div><h2><CalendarCheck size={20} /> توثيق الالتزام والوزن</h2><p>التوثيق مرتبط بتاريخ اليوم المحدد في الجدول، ويمكنك تسجيل الالتزام حتى دون إدخال الوزن.</p></div></div>
      <div className="form-actions"><button type="button" className="primary-button" onClick={recordCheckin} disabled={data.checkins.includes(todayKey)}><CheckCircle2 size={18} />{data.checkins.includes(todayKey) ? 'تم توثيق هذا اليوم' : 'وثّق الالتزام'}</button><span className="micro-note">{data.checkins.includes(todayKey) ? 'اليوم مسجّل ضمن سجل الالتزام.' : 'يمكن التراجع عن التوثيق بحذف سجل اليوم من النسخة الاحتياطية.'}</span></div>
      <div className="form-grid two" style={{ marginTop: 16 }}><label className="field-label">الوزن الحالي (كغم)<input className="field" type="number" min="20" max="400" step="0.1" inputMode="decimal" placeholder="مثلاً 95.0" value={weight} onChange={(e) => setWeight(e.target.value)} /></label><div className="field-label">حفظ سجل الوزن<button type="button" className="secondary-button" onClick={saveWeight} disabled={!weight.trim()}><Scale size={18} /> حفظ الوزن لهذا التاريخ</button></div></div>
      {monthWeights.length > 0 && <div className="meals-list" style={{ marginTop: 14 }}>{monthWeights.map((record) => <article className="meal-row" key={record.id}><div className="meal-symbol"><Scale size={20} /></div><div className="meal-copy"><h3>{record.weight} كغم</h3><p>{record.date}</p></div><button type="button" className="small-icon-button danger" aria-label="حذف سجل الوزن" onClick={() => onProgressChange({ weightHistory: data.weightHistory.filter((item) => item.id !== record.id) })}><Trash2 size={17} /></button></article>)}</div>}
    </section>
    <section className="content-section">
      <div className="section-heading"><div><h2>تقرير الشهر</h2><p>ملخص الشهر المحدد: {monthKey}</p></div></div>
      <div className="secondary-stats"><article><CalendarCheck size={21} /><div><strong>{monthCheckins}</strong><span>أيام الالتزام المسجلة</span></div></article><article><Scale size={21} /><div><strong>{monthWeights.length ? monthWeights[0].weight + ' كغم' : '—'}</strong><span>آخر وزن مسجل هذا الشهر</span></div></article><article><Target size={21} /><div><strong>{data.achievements.filter((item) => item.date.startsWith(monthKey)).length}</strong><span>إنجازات هذا الشهر</span></div></article></div>
      <div className="form-grid two" style={{ marginTop: 16 }}><label className="field-label">إنجاز جديد<input className="field" value={achievement} onChange={(e) => setAchievement(e.target.value)} placeholder="مثلاً: أنهيت مشروع البرمجة" maxLength={180} /></label><div className="field-label">إضافة إنجاز<button type="button" className="secondary-button" onClick={addAchievement} disabled={!achievement.trim()}><Plus size={18} /> إضافة</button></div></div>
      {data.achievements.length > 0 && <ul className="simple-list" style={{ marginTop: 12 }}>{[...data.achievements].sort((a, b) => b.date.localeCompare(a.date)).map((item) => <li key={item.id}><span><strong>{item.title}</strong><small>{item.date}</small></span><button type="button" className="small-icon-button danger" aria-label="حذف الإنجاز" onClick={() => onProgressChange({ achievements: data.achievements.filter((x) => x.id !== item.id) })}><Trash2 size={16} /></button></li>)}</ul>}
    </section>
    <section className="content-section">
      <div className="section-heading"><div><h2>التجاوزات والملاحظات الشهرية</h2><p>سجّل ما تريد مراجعته في التقرير بدل فقدانه من الذاكرة.</p></div></div>
      <div className="form-grid two"><label className="field-label">ملاحظة أو تعديل<input className="field" value={incident} onChange={(e) => setIncident(e.target.value)} placeholder="مثلاً: تأخر الدوام أو تعديل موعد" maxLength={500} /></label><div className="field-label">حفظ الملاحظة<button type="button" className="secondary-button" onClick={addIncident} disabled={!incident.trim()}><Plus size={18} /> إضافة للتقرير</button></div></div>
      {data.incidents.length > 0 && <ul className="simple-list" style={{ marginTop: 12 }}>{[...data.incidents].sort((a, b) => b.date.localeCompare(a.date)).map((item) => <li key={item.id}><span><strong>{item.text}</strong><small>{item.date}</small></span><button type="button" className="small-icon-button danger" aria-label="حذف الملاحظة" onClick={() => onProgressChange({ incidents: data.incidents.filter((x) => x.id !== item.id) })}><Trash2 size={16} /></button></li>)}</ul>}
    </section>
  </div>
}
