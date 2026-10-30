import { useEffect, useState } from 'react'
import { CloudDownload, ExternalLink, LogIn, LogOut, RefreshCw, Utensils } from 'lucide-react'

const SUPABASE_URL = 'https://chcapjgjvvwpljgdffpg.supabase.co'
const SUPABASE_KEY = 'sb_publishable_9dzltRprFtyXPyg0Iul3aQ_4SU1VTG9'
type CloudMeal = { id: number | string; title?: string | null; meal_type?: string | null; calories?: number | string | null; protein?: number | string | null; carbs?: number | string | null; fat?: number | string | null; starts_at: string; details?: string | null; source_app?: string | null }
type CloudUser = { id: string; email?: string }
type Props = { selectedDate: Date; onImport: (payload: unknown) => 'imported' | 'updated' }
function dateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}` }
function localTime(date: Date) { return `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}` }
function plusMinutes(time: string, amount: number) { const [h,m] = time.split(':').map(Number); const total = (h*60+m+amount)%1440; return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}` }

export function CloudMealsPanel({ selectedDate, onImport }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState('')
  const [user, setUser] = useState<CloudUser | null>(null)
  const [meals, setMeals] = useState<CloudMeal[]>([])
  const [message, setMessage] = useState('سجّل الدخول بنفس حساب تطبيق مساعدي الغذائي لعرض وجباتك المسجلة.')
  const [busy, setBusy] = useState(false)
  const [calories, setCalories] = useState(0)
  const [protein, setProtein] = useState(0)

  async function loadMeals(accessToken = token, account = user) {
    if (!accessToken || !account) return
    setBusy(true); setMessage('جارٍ تحميل وجبات التاريخ المحدد…')
    const start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate())
    const end = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()+1)
    const query = new URLSearchParams({ select: 'id,title,details,meal_type,calories,protein,carbs,fat,starts_at,source_app', user_id: `eq.${account.id}`, kind: 'eq.meal', starts_at: `gte.${start.toISOString()}`, order: 'starts_at.asc' })
    query.append('starts_at', `lt.${end.toISOString()}`)
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/shared_schedule?${query.toString()}`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${accessToken}` } })
      const result = await response.json() as CloudMeal[] | { message?: string }
      if (!response.ok || !Array.isArray(result)) throw new Error(('message' in result && result.message) || 'تعذّر تحميل الوجبات.')
      setMeals(result)
      setCalories(result.reduce((sum, meal) => sum + (Number(meal.calories)||0), 0))
      setProtein(result.reduce((sum, meal) => sum + (Number(meal.protein)||0), 0))
      setMessage(result.length ? `تم تحميل ${result.length} وجبة لهذا التاريخ.` : 'لا توجد وجبات مشتركة مسجلة لهذا التاريخ في حسابك.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'تعذر الاتصال بمساعدي الغذائي.') }
    finally { setBusy(false) }
  }
  async function login() {
    if (!email.trim() || !password) { setMessage('أدخل البريد الإلكتروني وكلمة المرور.'); return }
    setBusy(true); setMessage('جارٍ تسجيل الدخول…')
    try {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim(), password }) })
      const result = await response.json() as { access_token?: string; user?: CloudUser; msg?: string; message?: string; error_description?: string }
      if (!response.ok || !result.access_token || !result.user) throw new Error(result.error_description || result.msg || result.message || 'تعذر تسجيل الدخول.')
      setToken(result.access_token); setUser(result.user); setPassword('')
      await loadMeals(result.access_token, result.user)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'تعذر تسجيل الدخول.'); setBusy(false) }
  }
  useEffect(() => { if (token && user) void loadMeals(token, user) }, [selectedDate.toDateString()])
  function addToSchedule(meal: CloudMeal) {
    const when = new Date(meal.starts_at)
    if (Number.isNaN(when.getTime())) { setMessage('تاريخ الوجبة غير صالح.'); return }
    const time = localTime(when)
    try {
      const result = onImport({ externalId: `shared-schedule-${meal.id}`, name: meal.title || 'وجبة', kind: meal.meal_type || 'وجبة', date: dateKey(when), day: when.getDay(), start: time, end: plusMinutes(time, 30), calories: Number(meal.calories)||0, protein: Number(meal.protein)||0, carbs: Number(meal.carbs)||0, fat: Number(meal.fat)||0, source: meal.source_app === 'my-food-assistant' ? 'مساعدي الغذائي' : 'الجدول الموحد' })
      setMessage(result === 'updated' ? 'تم تحديث الوجبة المرتبطة في الجدول دون تكرارها.' : 'تمت إضافة الوجبة إلى الجدول.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'تعذر إضافة الوجبة.') }
  }
  function logout() { setToken(''); setUser(null); setMeals([]); setCalories(0); setProtein(0); setMessage('تم تسجيل الخروج.'); setPassword('') }

  return <section className="content-section">
    <div className="section-heading"><div><h2><CloudDownload size={20} /> الربط المباشر مع مساعدي الغذائي</h2><p>اعرض وجباتك المسجلة في السحابة وأضف أي وجبة إلى الموعد نفسه في جدولك.</p><a className="text-action" href="https://mohammedtareqabugosh-maker.github.io/my-food-assistant/" target="_blank" rel="noreferrer"><ExternalLink size={16} /> فتح مساعدي الغذائي</a></div></div>
    {!user ? <div className="form-grid two"><label className="field-label">البريد الإلكتروني<input className="field" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="البريد المستخدم في مساعدي الغذائي" /></label><label className="field-label">كلمة المرور<input className="field" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="كلمة مرور الحساب" /></label><div className="form-actions"><button type="button" className="primary-button" onClick={login} disabled={busy}><LogIn size={18} /> تسجيل الدخول</button></div></div> : <div className="form-actions"><span className="micro-note">مسجل الدخول: {user.email || 'حساب مساعدي الغذائي'}</span><button type="button" className="secondary-button" onClick={() => void loadMeals()} disabled={busy}><RefreshCw size={17} /> تحديث الوجبات</button><button type="button" className="text-action" onClick={logout}><LogOut size={17} /> تسجيل الخروج</button></div>}
    <div className="secondary-stats" style={{ marginTop: 14 }}><article><Utensils size={20} /><div><strong>{Math.round(calories).toLocaleString('en-US')}</strong><span>السعرات المسجلة</span></div></article><article><Utensils size={20} /><div><strong>{Math.round(protein*10)/10} غ</strong><span>البروتين المسجل</span></div></article></div>
    {message && <p className="form-message" role="status">{message}</p>}
    {meals.length > 0 && <div className="meals-list">{meals.map((meal) => <article className="meal-row" key={String(meal.id)}><div className="meal-symbol"><Utensils size={20} /></div><div className="meal-copy"><h3>{meal.title || 'وجبة'}</h3><p>{meal.meal_type || 'وجبة'} · {new Date(meal.starts_at).toLocaleTimeString('ar-JO',{hour:'2-digit',minute:'2-digit'})}</p><div className="nutrition-line"><span>{Number(meal.calories)||0} سعرة</span><span>بروتين {Number(meal.protein)||0}غ</span></div></div><button type="button" className="secondary-button compact-button" onClick={() => addToSchedule(meal)}>إضافة للجدول</button></article>)}</div>}
    <p className="micro-note">كلمة المرور لا تُحفظ في التطبيق. يلزم الاتصال بالإنترنت واستخدام نفس حساب التطبيقين لقراءة الوجبات من الجدول المشترك؛ باقي وظائف الجدول تبقى محلية.</p>
  </section>
}
