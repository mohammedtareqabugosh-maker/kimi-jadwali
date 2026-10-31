import { useState } from 'react'
import { ArrowRight, Check, RefreshCw, ShieldAlert, Sparkles } from 'lucide-react'
import type { AppData, ReplanProposal } from '../types'
import { EMERGENCY_NODES, applyReplan, buildReplan, type EmergencyOption, type ReplanResult } from '../lib/emergency'
import { dateKey, formatTime, isCompleted, nowMinutes } from '../lib/time'

interface EmergencyPageProps {
  data: AppData
  selectedDay: number
  selectedDate: Date
  onApply: (tasks: AppData['tasks']) => void
  onCommand: (question: string) => string | null
}

interface HistoryItem { nodeId: string; answer?: EmergencyOption }
interface AiMessage { role: 'user' | 'assistant'; text: string }

const AI_ENDPOINT = 'https://jadwali-ai.mohammedtareqabugosh.workers.dev'

export function EmergencyPage({ data, selectedDay, selectedDate, onApply, onCommand }: EmergencyPageProps) {
  const [history, setHistory] = useState<HistoryItem[]>([{ nodeId: 'start' }])
  const [aiQuestion, setAiQuestion] = useState('')
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([])
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState('')
  const [applied, setApplied] = useState(false)
  const currentEntry = history.at(-1)!
  const node = EMERGENCY_NODES[currentEntry.nodeId]
  const completedIds = data.tasks.filter((task) => task.day === selectedDay && isCompleted(data.completions, selectedDate, task.id)).map((task) => task.id)
  const result: ReplanResult | null = node.id === 'plan' ? buildReplan(data.tasks, selectedDay, completedIds, nowMinutes()) : null
  const choose = (option: EmergencyOption) => { setApplied(false); setHistory((items) => [...items, { nodeId: option.next, answer: option }]) }
  const back = () => { if (history.length > 1) { setApplied(false); setHistory((items) => items.slice(0, -1)) } }
  const restart = () => { setApplied(false); setHistory([{ nodeId: 'start' }]) }
  const apply = (proposals: ReplanProposal[]) => { onApply(applyReplan(data.tasks, proposals)); setApplied(true) }
  const askAi = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const question = aiQuestion.trim()
    if (!question || aiBusy) return
    const dayTasks = data.tasks
      .filter((task) => task.day === selectedDay)
      .map((task) => ({
        title: task.title,
        start: task.start,
        end: task.end,
        type: task.type,
        fixed: task.fixed,
        completed: isCompleted(data.completions, selectedDate, task.id),
        notes: task.notes || '',
      }))
    const nextMessages: AiMessage[] = [...aiMessages, { role: 'user', text: question }]
    setAiMessages(nextMessages)
    setAiQuestion('')
    setAiError('')
    const commandReply = onCommand(question)
    if (commandReply !== null) {
      setAiMessages([...nextMessages, { role: 'assistant', text: commandReply }])
      return
    }
    setAiBusy(true)
    const controller = new AbortController()
    const requestTimeout = window.setTimeout(() => controller.abort(), 20000)
    try {
      const response = await fetch(AI_ENDPOINT, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problem: question,
          context: {
            app: 'جدولي الأسبوعي',
            date: selectedDate.toLocaleDateString('ar-JO'),
            day: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][selectedDay],
            currentTime: new Date().toLocaleTimeString('ar-JO', { hour: '2-digit', minute: '2-digit' }),
            tasks: dayTasks,
            instruction: 'أجب بالعربية وبشكل عملي ومختصر. اقترح خطة واقعية مع احترام العمل والجامعة والمواعيد الثابتة والنوم. لا تدّع أنك عدّلت الجدول؛ التطبيق لا يغيّر أي مهمة إلا بموافقة المستخدم.',
          },
        }),
      })
      const result = await response.json() as { ok?: boolean; answer?: string; error?: string; message?: string }
      if (!response.ok || result.ok === false || !result.answer) {
        throw new Error(result.error || result.message || 'خدمة الذكاء الاصطناعي لم تُرجع إجابة صالحة.')
      }
      setAiMessages((items) => [...items, { role: 'assistant', text: result.answer! }])
    } catch (error) {
      const message = error instanceof Error && error.name === 'AbortError'
        ? 'تأخر رد المساعد أكثر من 20 ثانية. جرّب مرة أخرى أو استخدم الأوامر المحلية.'
        : error instanceof Error ? error.message : 'تعذر الاتصال بالذكاء الاصطناعي. يمكنك استخدام المحادثة المحلية أدناه.'
      setAiError(message)
    } finally {
      window.clearTimeout(requestTimeout)
      setAiBusy(false)
    }
  }

  return <div className="page-stack emergency-page">
    <section className="page-heading"><div><span className="section-kicker">مساعد محلي · يعمل دون إنترنت</span><h1>مخرج الطوارئ</h1><p>مساعد لإدارة جدولك بالأوامر العربية، بالإضافة إلى اقتراحات إعادة تنظيم اليوم.</p></div><button type="button" className="secondary-button" onClick={restart}><RefreshCw size={18} /> محادثة جديدة</button></section>
    <section className="conversation-panel" aria-label="المساعد الذكي">
      <div className="section-heading"><div><h2><Sparkles size={20} /> اسأل الذكاء الاصطناعي</h2><p>يمكنك سؤاله، أو إصدار أوامر مباشرة مثل «احذف محاضرة البرمجة يوم الأحد» و«أضف مذاكرة البرمجة يوم الأحد من 19:00 إلى 20:00». أوامر الإضافة والحذف المدعومة تعمل محليًا، والأسئلة العامة تستخدم خدمة الذكاء الاصطناعي عبر الإنترنت.</p></div></div>
      {aiMessages.length > 0 && <div className="chat-history" aria-live="polite">{aiMessages.map((message, index) => <div key={index} className={message.role === 'user' ? 'user-message' : 'assistant-message'}><p>{message.text}</p></div>)}</div>}
      {aiError && <p className="form-message" role="alert">{aiError}</p>}
      <form className="ai-ask-form" onSubmit={askAi}>
        <label className="field-label">شو المشكلة أو السؤال؟
          <input className="field" value={aiQuestion} onChange={(event) => setAiQuestion(event.target.value)} placeholder="مثلاً: تأخرت ساعة، كيف أرتّب باقي يومي؟" maxLength={1200} disabled={aiBusy} />
        </label>
        <button type="submit" className="primary-button" disabled={aiBusy || !aiQuestion.trim()}><Sparkles size={18} />{aiBusy ? 'الذكاء الاصطناعي يفكر…' : 'اسأل المساعد'}</button>
      </form>
      {aiMessages.length > 0 && <div className="form-actions"><button type="button" className="text-action" onClick={() => { setAiMessages([]); setAiError('') }}>مسح المحادثة الذكية</button></div>}
    </section>
    <div className="conversation-layout">
      <section className="conversation-panel" aria-live="polite">
        <div className="chat-history">{history.slice(0, -1).map((entry, index) => { const answer = history[index + 1]?.answer; return <div className="chat-pair" key={`${entry.nodeId}-${index}`}><div className="assistant-message">{EMERGENCY_NODES[entry.nodeId]?.text}</div>{answer && <div className="user-message">{answer.label}</div>}</div> })}</div>
        <div className={`assistant-message current-message ${node.tone === 'safety' ? 'safety-message' : ''}`}>{node.tone === 'safety' && <ShieldAlert size={22} />}<p>{node.text}</p></div>
        {node.id !== 'plan' ? <div className="answer-options">{node.options.map((option) => <button type="button" key={option.id} onClick={() => choose(option)}>{option.label}</button>)}</div> : <div className="replan-result">
          <p className="plan-message">{result?.message}</p>
          {result?.proposals.length ? <div className="proposal-list">{result.proposals.map((proposal) => <article key={proposal.taskId}><div><strong>{proposal.title}</strong><span>{formatTime(proposal.oldStart)} ← {formatTime(proposal.newStart)} — {formatTime(proposal.newEnd)}</span><small>{proposal.reason}</small></div></article>)}</div> : null}
          {result?.unscheduled.length ? <div className="unscheduled-box"><strong>لم تتسع هذه المهام:</strong><p>{result.unscheduled.map((task) => `${task.title}${task.allowSplit ? ' (يمكن تقسيمها)' : ' (يمكن تأجيلها)'}`).join('، ')}</p></div> : null}
          {result?.proposals.length ? <button type="button" className="primary-button" onClick={() => apply(result.proposals)} disabled={applied}>{applied ? <Check size={18} /> : <Sparkles size={18} />}{applied ? 'طُبّق الاقتراح' : `مراجعة وتطبيق ${result.proposals.length} تعديلات`}</button> : <button type="button" className="secondary-button" onClick={restart}>إعادة تقييم اليوم</button>}
          {applied && <p className="success-message" role="status">تم تحديث المهام المرنة فقط، وبقيت حالات الإنجاز والمواعيد الثابتة كما هي.</p>}
        </div>}
        <div className="conversation-controls"><button type="button" className="text-action" onClick={back} disabled={history.length <= 1}><ArrowRight size={17} /> السؤال السابق</button><span>الخطوة {history.length} · محادثة {dateKey(selectedDate)}</span></div>
      </section>
      <aside className="emergency-aside"><h2>ما الذي سيحدث؟</h2><ol><li>نستبعد المهام المنجزة.</li><li>نحافظ على المواعيد الثابتة وفترات الراحة والنوم.</li><li>نبحث عن فجوات تتسع للمدة كاملة.</li><li>نعرض الاقتراح أولًا، ثم تختار تطبيقه.</li></ol><p>إذا لم توجد فترة كافية، سنقول ذلك بوضوح بدل ضغط المهام أو تعديل مواعيد أخرى.</p></aside>
    </div>
  </div>
}
