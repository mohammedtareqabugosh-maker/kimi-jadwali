import { useCallback, useEffect, useState } from 'react'
import { Clock3, MapPin, RefreshCw, Sunrise, Sun, Sunset } from 'lucide-react'

type Timings = { Fajr: string; Sunrise: string; Dhuhr: string; Asr: string; Maghrib: string; Isha: string }
type PrayerResponse = { code: number; data?: { timings: Timings; date: { readable: string; hijri: { date: string; month: { ar: string }; year: string } }; meta?: { timezone?: string } }; status?: string }

const PRAYERS = [
  { key: 'Fajr', label: 'الفجر', icon: Sunrise },
  { key: 'Dhuhr', label: 'الظهر', icon: Sun },
  { key: 'Asr', label: 'العصر', icon: Sun },
  { key: 'Maghrib', label: 'المغرب', icon: Sunset },
  { key: 'Isha', label: 'العشاء', icon: Clock3 },
] as const

function dateKey(date: Date) {
  return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`
}
function cleanTime(value: string) { return value?.split(' ')[0] ?? '--:--' }
function minutes(value: string) {
  const [hour, minute] = cleanTime(value).split(':').map(Number)
  return hour * 60 + minute
}
function toArabicTime(value: string) {
  const raw = cleanTime(value)
  const [hour, minute] = raw.split(':').map(Number)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return '--:--'
  const date = new Date()
  date.setHours(hour, minute, 0, 0)
  return new Intl.DateTimeFormat('ar-JO', { hour: 'numeric', minute: '2-digit', hour12: true }).format(date)
}

export function PrayerTimesPage() {
  const [today, setToday] = useState(() => new Date())
  const [timings, setTimings] = useState<Timings | null>(null)
  const [hijri, setHijri] = useState('')
  const [timezone, setTimezone] = useState('Asia/Amman')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError('')
    const date = new Date()
    setToday(date)
    const url = `https://api.aladhan.com/v1/timingsByCity/${dateKey(date)}?city=Amman&country=Jordan&method=23`
    try {
      const response = await fetch(url, { signal, cache: 'no-store' })
      if (!response.ok) throw new Error('تعذّر جلب مواقيت الصلاة حاليًا.')
      const result = await response.json() as PrayerResponse
      if (result.code !== 200 || !result.data?.timings) throw new Error('لم تصل مواقيت الصلاة بشكل صحيح.')
      setTimings(result.data.timings)
      setHijri(`${result.data.date.hijri.date} ${result.data.date.hijri.month.ar} ${result.data.date.hijri.year} هـ`)
      setTimezone(result.data.meta?.timezone || 'Asia/Amman')
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return
      setError(e instanceof Error ? e.message : 'حدث خطأ أثناء تحميل المواقيت.')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, 60000)
    const onVisible = () => { if (document.visibilityState === 'visible') void load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      controller.abort()
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load, refreshKey])

  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const nextPrayer = timings ? PRAYERS.find((prayer) => minutes(timings[prayer.key]) > nowMinutes) ?? PRAYERS[0] : null
  const nextTime = nextPrayer && timings ? minutes(timings[nextPrayer.key]) : null
  const remaining = nextTime === null ? '' : (() => {
    const delta = (nextTime - nowMinutes + 1440) % 1440
    return `${Math.floor(delta / 60)} س ${delta % 60} د`
  })()

  return <div className="page-stack prayer-page">
    <section className="page-heading">
      <div><span className="section-kicker"><Clock3 size={16} /> مواقيت اليوم</span><h1>جدول الصلوات</h1><p>مواقيت يومية لعمّان، الأردن، تتجدد تلقائيًا مع تغيّر التاريخ.</p></div>
      <button type="button" className="secondary-button" onClick={() => setRefreshKey((n) => n + 1)} disabled={loading}><RefreshCw size={17} /> تحديث المواقيت</button>
    </section>
    <section className="prayer-date-card">
      <div className="prayer-location"><MapPin size={18} /><span>عمّان، الأردن</span><span className="prayer-timezone">{timezone}</span></div>
      <strong>{new Intl.DateTimeFormat('ar-JO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(today)}</strong>
      {hijri && <span>{hijri}</span>}
      <small>تاريخ ووقت الجهاز: {new Intl.DateTimeFormat('ar-JO', { hour: 'numeric', minute: '2-digit', hour12: true }).format(now)}</small>
    </section>
    {nextPrayer && timings && <section className="prayer-next-card"><div><span>الصلاة القادمة</span><h2>{nextPrayer.label}</h2><p>باقي تقريبًا {remaining}</p></div><strong>{toArabicTime(timings[nextPrayer.key])}</strong></section>}
    <section className="prayer-list" aria-label="مواقيت الصلاة">
      {loading && !timings && <div className="prayer-state"><span className="loading-line"><span /></span><p>جارٍ تحميل مواقيت الصلاة…</p></div>}
      {error && !timings && <div className="prayer-state"><p>{error}</p><button type="button" className="primary-button" onClick={() => setRefreshKey((n) => n + 1)}>إعادة المحاولة</button><small>يلزم اتصال بالإنترنت لجلب مواقيت اليوم.</small></div>}
      {timings && PRAYERS.map(({ key, label, icon: Icon }) => {
        const active = nextPrayer?.key === key
        const passed = minutes(timings[key]) <= nowMinutes && !active
        return <div className={`prayer-row ${active ? 'is-next' : ''} ${passed ? 'is-passed' : ''}`} key={key}>
          <span className="prayer-icon"><Icon size={21} /></span><span className="prayer-name"><strong>{label}</strong>{active && <small>الصلاة القادمة</small>}</span><strong className="prayer-time">{toArabicTime(timings[key])}</strong>
        </div>
      })}
      {timings && <div className="prayer-sunrise"><Sunrise size={17} /><span>الشروق</span><strong>{toArabicTime(timings.Sunrise)}</strong></div>}
    </section>
    <p className="prayer-disclaimer">المواقيت تُجلب يوميًا من خدمة مواقيت الصلاة وقد تختلف دقائق بسيطة عن تقويم وزارة الأوقاف المحلي. يتم تحديثها عند فتح الصفحة وكل دقيقة أثناء بقائها مفتوحة.</p>
  </div>
}
