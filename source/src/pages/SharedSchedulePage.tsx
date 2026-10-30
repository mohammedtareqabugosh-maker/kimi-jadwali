import { useEffect, useState } from 'react'
/* eslint-disable react-hooks/set-state-in-effect -- External auth/storage hydration and date-triggered async loading are intentional effects. */
import { CalendarDays, Cloud, LogIn, LogOut, Plus, RefreshCw, Trash2, Utensils } from 'lucide-react'
import { Modal } from '../components/Modal'

const SUPABASE_URL = 'https://chcapjgjvvwpljgdffpg.supabase.co'
const SUPABASE_KEY = 'sb_publishable_9dzltRprFtyXPyg0Iul3aQ_4SU1VTG9'
type User = { id: string; email?: string }
type Entry = { id: string; user_id?: string; kind: 'task'|'appointment'|'meal'; title: string; details?: string; starts_at: string; meal_type?: string; calories?: number; protein?: number; source_app?: string; updated_at?: string }
type Session = { access_token: string; refresh_token?: string; user: User }
type Props = { onImportMany: (payloads: unknown[], range: { start: string; end: string }) => void }
const pad = (n:number) => String(n).padStart(2,'0')
const dateKey = (d:Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
const fromDateKey = (s:string) => { const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d,12) }
const endTime = (d:Date) => { const n = new Date(d.getTime()+30*60000); return `${pad(n.getHours())}:${pad(n.getMinutes())}` }
const kindLabel = (k:Entry['kind']) => k === 'meal' ? 'وجبة' : k === 'appointment' ? 'موعد' : 'مهمة'

export function SharedSchedulePage({ onImportMany }: Props) {
  const [session, setSession] = useState<Session|null>(null)
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [signup,setSignup]=useState(false)
  const [rows,setRows]=useState<Entry[]>([])
  const [message,setMessage]=useState('سجّل الدخول بنفس حساب التطبيقين لمزامنة المهام والوجبات بينهما.')
  const [busy,setBusy]=useState(false)
  const [selectedDate,setSelectedDate]=useState(dateKey(new Date()))
  const [kind,setKind]=useState<Entry['kind']>('task')
  const [title,setTitle]=useState('')
  const [time,setTime]=useState('20:00')
  const [details,setDetails]=useState('')
  const [calories,setCalories]=useState('')
  const [protein,setProtein]=useState('')
  const [deleting,setDeleting]=useState<Entry|null>(null)

  async function authRequest(path:string, body:Record<string,string>) {
    const response=await fetch(`${SUPABASE_URL}/auth/v1/${path}`,{method:'POST',headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify(body)})
    const result=await response.json()
    if(!response.ok) throw new Error(result.msg||result.message||result.error_description||'تعذرت المصادقة.')
    return result as Session & { refresh_token?: string; access_token?: string; user?: User }
  }
  async function login() {
    if(!email.trim()||!password){setMessage('أدخل البريد الإلكتروني وكلمة المرور.');return}
    setBusy(true);setMessage(signup?'جارٍ إنشاء الحساب…':'جارٍ تسجيل الدخول…')
    try {
      const result=await authRequest(signup?'signup':'token?grant_type=password',{email:email.trim(),password})
      if(!result.access_token||!result.user){setMessage('تم إرسال طلب إنشاء الحساب. إذا طُلب تأكيد البريد، أكّده ثم سجّل الدخول.');return}
      const next:Session={access_token:result.access_token,refresh_token:result.refresh_token,user:result.user}
      sessionStorage.setItem('jadwali-shared-session',JSON.stringify(next));setSession(next);setPassword('');setMessage('تم تسجيل الدخول.');await pull(next)
    } catch(e){setMessage(e instanceof Error?e.message:'تعذّر تسجيل الدخول.')} finally{setBusy(false)}
  }
  async function pull(active=session) {
    if(!active)return
    setBusy(true);setMessage('جارٍ تحميل الجدول الموحد…')
    try {
      const selected=fromDateKey(selectedDate)
      const start=new Date(selected.getFullYear(),selected.getMonth(),selected.getDate()-selected.getDay())
      const end=new Date(start.getFullYear(),start.getMonth(),start.getDate()+7)
      const q=new URLSearchParams({select:'*',user_id:`eq.${active.user.id}`,starts_at:`gte.${start.toISOString()}`,order:'starts_at.asc'})
      q.append('starts_at',`lt.${end.toISOString()}`)
      const response=await fetch(`${SUPABASE_URL}/rest/v1/shared_schedule?${q.toString()}`,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${active.access_token}`}})
      const result=await response.json()
      if(!response.ok||!Array.isArray(result))throw new Error(result.message||'تعذّر تحميل الجدول المشترك. تحقق من إعداد جدول shared_schedule في Supabase.')
      setRows(result as Entry[])
      const payloads=(result as Entry[]).filter(row=>row.kind==='meal'&&row.starts_at).flatMap(row=>{const when=new Date(row.starts_at);return Number.isNaN(when.getTime())?[]:[{externalId:`shared-schedule-${row.id}`,name:row.title,kind:row.meal_type||'وجبة',date:dateKey(when),day:when.getDay(),start:`${pad(when.getHours())}:${pad(when.getMinutes())}`,end:endTime(when),calories:Number(row.calories)||0,protein:Number(row.protein)||0,source:'الجدول الموحد'}]})
      onImportMany(payloads, { start: dateKey(start), end: dateKey(end) })
      setMessage(`تم تحميل ${result.length} عنصرًا للأسبوع. ${payloads.length?'تمت مزامنة الوجبات إلى جدولك المحلي.':''}`)
    }catch(e){setMessage(e instanceof Error?e.message:'تعذر الاتصال بالجدول المشترك.')}finally{setBusy(false)}
  }
  useEffect(()=>{if(session)void pull(session)},[selectedDate,session])
  useEffect(()=>{try{const saved=sessionStorage.getItem('jadwali-shared-session');if(saved){const parsed=JSON.parse(saved) as Session;if(parsed.access_token&&parsed.user)setSession(parsed)}}catch{sessionStorage.removeItem('jadwali-shared-session')}},[])
  async function saveEntry(e:React.FormEvent) {
    e.preventDefault()
    if(!session||!title.trim()||!selectedDate||!time)return
    setBusy(true);setMessage('جارٍ حفظ العنصر…')
    try{
      const starts=new Date(`${selectedDate}T${time}:00`)
      const row:Entry={id:crypto.randomUUID(),user_id:session.user.id,kind,title:title.trim(),details:details.trim(),starts_at:starts.toISOString(),meal_type:kind==='meal'?'وجبة':'',calories:kind==='meal'?Number(calories)||0:0,protein:kind==='meal'?Number(protein)||0:0,source_app:'jadwali-weekly',updated_at:new Date().toISOString()}
      const response=await fetch(`${SUPABASE_URL}/rest/v1/shared_schedule`,{method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(row)})
      const result=await response.json()
      if(!response.ok)throw new Error(result.message||'تعذر حفظ العنصر. تحقق من صلاحيات جدول shared_schedule.')
      setTitle('');setDetails('');setCalories('');setProtein('');await pull(session)
    }catch(e){setMessage(e instanceof Error?e.message:'تعذّر حفظ العنصر.')}finally{setBusy(false)}
  }
  async function deleteEntry() {
    if(!session||!deleting)return
    setBusy(true)
    try{
      const q=new URLSearchParams({id:`eq.${deleting.id}`,user_id:`eq.${session.user.id}`})
      const response=await fetch(`${SUPABASE_URL}/rest/v1/shared_schedule?${q}`,{method:'DELETE',headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${session.access_token}`}})
      if(!response.ok){const result=await response.json();throw new Error(result.message||'تعذر حذف العنصر.')}
      setDeleting(null);await pull(session)
    }catch(e){setMessage(e instanceof Error?e.message:'تعذر الحذف.')}finally{setBusy(false)}
  }
  function logout(){sessionStorage.removeItem('jadwali-shared-session');setSession(null);setRows([]);setMessage('تم تسجيل الخروج من الجدول الموحد.')}
  const weekStart=(()=>{const d=fromDateKey(selectedDate);d.setDate(d.getDate()-d.getDay());return d})()
  const weekDates=Array.from({length:7},(_,i)=>{const d=new Date(weekStart);d.setDate(d.getDate()+i);return d})
  const visible=rows.filter(row=>dateKey(new Date(row.starts_at))===selectedDate)
  return <div className="page-stack">
    <section className="page-heading"><div><span className="section-kicker">مزامنة بين التطبيقين</span><h1>الجدول الموحد</h1><p>أضف مهامًا ومواعيد ووجبات إلى مساحة مشتركة تظهر في التطبيقين عند استخدام الحساب نفسه.</p></div><Cloud size={25}/></section>
    {!session?<section className="content-section"><div className="section-heading"><div><h2><LogIn size={20}/> الحساب المشترك</h2><p>استخدم نفس البريد وكلمة المرور في مساعدي الغذائي.</p></div></div><form className="form-stack" onSubmit={(e)=>{e.preventDefault();void login()}}><label className="field-label">البريد الإلكتروني<input className="field" type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" required/></label><label className="field-label">كلمة المرور<input className="field" type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required/></label><div className="form-actions"><button type="submit" className="primary-button" disabled={busy}><LogIn size={18}/>{signup?'إنشاء حساب':'تسجيل الدخول'}</button><button type="button" className="secondary-button" onClick={()=>setSignup(!signup)}>{signup?'لدي حساب بالفعل':'إنشاء حساب جديد'}</button></div></form></section>:<>
      <section className="content-section"><div className="section-heading"><div><h2>حسابك</h2><p>{session.user.email||'تم تسجيل الدخول'}</p></div><div className="form-actions"><button type="button" className="secondary-button" onClick={()=>void pull()} disabled={busy}><RefreshCw size={17}/> تحديث</button><button type="button" className="text-action" onClick={logout}><LogOut size={17}/> خروج</button></div></div></section>
      <section className="content-section"><div className="section-heading"><div><h2><CalendarDays size={20}/> أيام الأسبوع</h2><p>اختر اليوم لعرض عناصره وإضافتها.</p></div></div><div className="day-strip">{weekDates.map((d,i)=><button type="button" key={dateKey(d)} className={selectedDate===dateKey(d)?'selected':''} onClick={()=>setSelectedDate(dateKey(d))}><strong>{['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'][i]}</strong><span>{d.getDate()}/{d.getMonth()+1}</span></button>)}</div></section>
      <section className="content-section"><div className="section-heading"><div><h2>عناصر {['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'][fromDateKey(selectedDate).getDay()]}</h2><p>{visible.length} عنصرًا في اليوم المحدد</p></div></div>{visible.length? <div className="meals-list">{visible.map(row=><article className="meal-row" key={row.id}><div className="meal-symbol">{row.kind==='meal'?<Utensils size={20}/>:<CalendarDays size={20}/>}</div><div className="meal-copy"><h3>{row.title}</h3><p>{new Date(row.starts_at).toLocaleTimeString('ar-JO',{hour:'2-digit',minute:'2-digit'})} · {kindLabel(row.kind)}</p>{row.details&&<p>{row.details}</p>}{row.kind==='meal'&&<div className="nutrition-line"><span>{Number(row.calories)||0} سعرة</span><span>بروتين {Number(row.protein)||0}غ</span></div>}</div><button type="button" className="small-icon-button danger" onClick={()=>setDeleting(row)} aria-label="حذف العنصر"><Trash2 size={17}/></button></article>)}</div>:<div className="empty-state"><CalendarDays size={28}/><h3>لا توجد عناصر لهذا اليوم</h3><p>أضف أول مهمة أو موعد أو وجبة أدناه.</p></div>}</section>
      <section className="content-section"><div className="section-heading"><div><h2><Plus size={20}/> إضافة إلى الجدول الموحد</h2><p>الوجبات التي تضيفها هنا ستظهر في الجدول المحلي عند تحديثه.</p></div></div><form className="form-stack" onSubmit={saveEntry}><div className="form-grid two"><label className="field-label">نوع العنصر<select className="field" value={kind} onChange={e=>setKind(e.target.value as Entry['kind'])}><option value="task">مهمة</option><option value="appointment">موعد</option><option value="meal">وجبة</option></select></label><label className="field-label">التاريخ<input className="field" type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)} required/></label><label className="field-label">الاسم<input className="field" value={title} onChange={e=>setTitle(e.target.value)} maxLength={140} required placeholder="اسم المهمة أو الوجبة"/></label><label className="field-label">الوقت<input className="field" type="time" value={time} onChange={e=>setTime(e.target.value)} required/></label>{kind==='meal'&&<><label className="field-label">السعرات<input className="field" type="number" min="0" value={calories} onChange={e=>setCalories(e.target.value)}/></label><label className="field-label">البروتين (غ)<input className="field" type="number" min="0" step="0.1" value={protein} onChange={e=>setProtein(e.target.value)}/></label></>}</div><label className="field-label">التفاصيل<textarea className="field" rows={2} value={details} onChange={e=>setDetails(e.target.value)} maxLength={400}/></label><button type="submit" className="primary-button" disabled={busy}><Plus size={18}/> حفظ في الجدول الموحد</button></form></section>
    </>}
    <p className="form-message" role="status">{message}</p>
    {deleting&&<Modal title="حذف من الجدول الموحد" onClose={()=>setDeleting(null)}><div className="delete-confirm"><p>هل تريد حذف «{deleting.title}» من السحابة؟</p><span>سيختفي من التطبيقات المرتبطة بهذا الحساب.</span><div className="modal-actions"><button type="button" className="secondary-button" onClick={()=>setDeleting(null)}>إلغاء</button><button type="button" className="danger-button" onClick={()=>void deleteEntry()} disabled={busy}>حذف</button></div></div></Modal>}
  </div>
}
