import { useState, useMemo, useEffect, useRef } from 'react'
import data from './content.json'

const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort()
const FB_KEY = 'igc_feedback_v1'

export default function App() {
  const { scripts = [], sources = [], persona = {} } = data
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [ctype, setCtype] = useState('')
  const [htype, setHtype] = useState('')
  const [funnel, setFunnel] = useState('')
  const [src, setSrc] = useState('')
  const [vote, setVote] = useState('')
  const [day, setDay] = useState('')
  const [batch, setBatch] = useState('')
  const [product, setProduct] = useState('')
  const [sort, setSort] = useState('-id')
  const [cloud, setCloud] = useState('…')
  const loaded = useRef(false)
  const [fb, setFb] = useState(() => {
    try { return JSON.parse(localStorage.getItem(FB_KEY)) || {} } catch { return {} }
  })

  useEffect(() => { document.body.dataset.theme = theme; localStorage.setItem('theme', theme) }, [theme])

  // load feedback from the cloud DB on open (cloud merges over local)
  useEffect(() => {
    fetch('/api/feedback').then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (d && d.feedback) setFb((prev) => ({ ...prev, ...d.feedback }))
      setCloud('☁️ متصل')
    }).catch(() => setCloud('💾 محلي')).finally(() => { loaded.current = true })
  }, [])

  // persist to local always; debounce-save to cloud after initial load
  useEffect(() => {
    localStorage.setItem(FB_KEY, JSON.stringify(fb))
    if (!loaded.current) return
    setCloud('… بيحفظ')
    const t = setTimeout(() => {
      fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ feedback: fb }) })
        .then((r) => setCloud(r.ok ? '☁️ متحفوظ' : '💾 محلي')).catch(() => setCloud('💾 محلي'))
    }, 1200)
    return () => clearTimeout(t)
  }, [fb])

  const setVoteFor = (id, v) => setFb((p) => ({ ...p, [id]: { ...p[id], vote: p[id]?.vote === v ? null : v } }))
  const setNoteFor = (id, note) => setFb((p) => ({ ...p, [id]: { ...p[id], note } }))

  const contentTypes = useMemo(() => uniq(scripts.map((s) => s.content_type)), [scripts])
  const hookTypes = useMemo(() => uniq(scripts.map((s) => s.hook_type)), [scripts])
  const handles = useMemo(() => uniq(scripts.map((s) => s.source_handle)), [scripts])
  const dates = useMemo(() => uniq(scripts.map((s) => (s.created_at || '').slice(0, 10))), [scripts])
  const batches = useMemo(() => uniq(scripts.map((s) => s.batch)), [scripts])
  const products = useMemo(() => uniq(scripts.map((s) => s.product)), [scripts])

  const stats = useMemo(() => {
    let liked = 0, disliked = 0, noted = 0
    scripts.forEach((s) => {
      const v = fb[s.id]?.vote
      if (v === 'like') liked++; else if (v === 'dislike') disliked++
      if (fb[s.id]?.note?.trim()) noted++
    })
    const rated = liked + disliked
    return { liked, disliked, noted, rated, pct: rated ? Math.round((liked / rated) * 100) : 0 }
  }, [scripts, fb])

  const rows = useMemo(() => {
    let r = scripts
      .filter((s) => !status || s.status === status)
      .filter((s) => !ctype || s.content_type === ctype)
      .filter((s) => !htype || s.hook_type === htype)
      .filter((s) => !funnel || s.funnel === funnel)
      .filter((s) => !src || s.source_handle === src)
      .filter((s) => !batch || s.batch === batch)
      .filter((s) => !product || s.product === product)
      .filter((s) => !day || (s.created_at || '').slice(0, 10) === day)
      .filter((s) => !vote || (vote === 'unrated' ? !fb[s.id]?.vote : fb[s.id]?.vote === vote))
    if (q.trim()) {
      const n = q.trim()
      r = r.filter((s) => [s.title_ar, s.title_en, s.hook, s.vo, s.cta, s.caption, s.inspired_by]
        .filter(Boolean).join(' ').includes(n))
    }
    const desc = sort[0] === '-'; const key = desc ? sort.slice(1) : sort
    return [...r].sort((a, b) => {
      const x = a[key], y = b[key]
      if (typeof x === 'string') return desc ? (y > x ? 1 : -1) : (x > y ? 1 : -1)
      return desc ? (y || 0) - (x || 0) : (x || 0) - (y || 0)
    })
  }, [scripts, q, status, ctype, htype, funnel, src, day, vote, batch, product, sort, fb])

  const reset = () => { setQ(''); setStatus(''); setCtype(''); setHtype(''); setFunnel(''); setSrc(''); setDay(''); setVote(''); setBatch(''); setProduct(''); setSort('-id') }

  const exportFeedback = () => {
    const out = scripts.filter((s) => fb[s.id]?.vote || fb[s.id]?.note?.trim())
      .map((s) => ({ id: s.id, title: s.title_ar, vote: fb[s.id]?.vote || null, note: fb[s.id]?.note || '' }))
    const json = JSON.stringify({ feedback: out, liked_pct: stats.pct, when: new Date().toISOString().slice(0, 10) }, null, 2)
    navigator.clipboard?.writeText(json).catch(() => {})
    const blob = new Blob([json], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = 'feedback.json'; a.click()
    alert('اتنسخ كمان للكليبورد. ابعتهولي عشان أحسّن الجيل الجاي.')
  }

  const FUNNELS = ['TOF', 'MOF', 'BOF']

  return (
    <div className="wrap">
      <header>
        <button className="theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? '☀️ فاتح' : '🌙 غامق'}
        </button>
        <h1>🦞 Prime Softworks — Content DB</h1>
        <p>{scripts.length} سكريبت · {sources.length} مصادر · لايك/ديسلايك + نوتس + فلاتر TOF/MOF/BOF</p>
        <span className="meta">آخر تحديث {data.generated}</span>
      </header>

      <div className="panel statbar">
        <div className="stat"><b>{stats.pct}%</b><span>نسبة الإعجاب</span></div>
        <div className="stat like"><b>{stats.liked}</b><span>👍 عجبني</span></div>
        <div className="stat dislike"><b>{stats.disliked}</b><span>👎 مش عاجبني</span></div>
        <div className="stat"><b>{stats.noted}</b><span>📝 ملاحظات</span></div>
        <div className="stat"><b style={{ fontSize: '13px' }}>{cloud}</b><span>الداتابيز</span></div>
        <button className="export" onClick={exportFeedback}>⬇️ نسخة احتياطية</button>
      </div>

      <div className="panel">
        <h3>👤 البروفايل والتفضيلات</h3>
        <p><b>بيحب:</b> {persona.likes}</p>
        <p className="nogo"><b>NO-GO:</b> {persona.no_go}</p>
        <p><b>النبرة:</b> {persona.voice_notes}</p>
      </div>

      <div className="panel">
        <h3>📊 المصادر اللي اتحللت</h3>
        <table>
          <thead><tr><th>الحساب</th><th>متابعين</th><th>ريلز</th><th>آخر استيراد</th></tr></thead>
          <tbody>{sources.map((s) => (
            <tr key={s.handle}><td style={{ direction: 'ltr' }}>@{s.handle}</td><td>{(s.followers || 0).toLocaleString()}</td><td>{s.reels_analyzed || 0}</td><td>{s.imported_at}</td></tr>
          ))}</tbody>
        </table>
      </div>

      <div className="controls">
        <input placeholder="ابحث…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="key-filter" value={batch} onChange={(e) => setBatch(e.target.value)}><option value="">🗂️ كل الجيلات</option>{batches.map((b) => <option key={b} value={b}>{b}</option>)}</select>
        <select className="key-filter" value={product} onChange={(e) => setProduct(e.target.value)}><option value="">🛍️ كل المنتجات</option>{products.map((p) => <option key={p} value={p}>{p}</option>)}</select>
        <select value={funnel} onChange={(e) => setFunnel(e.target.value)}><option value="">كل المراحل</option>{FUNNELS.map((f) => <option key={f} value={f}>{f}</option>)}</select>
        <select value={ctype} onChange={(e) => setCtype(e.target.value)}><option value="">كل الأنواع</option>{contentTypes.map((t) => <option key={t} value={t}>{t}</option>)}</select>
        <select value={htype} onChange={(e) => setHtype(e.target.value)}><option value="">كل الهوكات</option>{hookTypes.map((t) => <option key={t} value={t}>{t}</option>)}</select>
        <select value={src} onChange={(e) => setSrc(e.target.value)}><option value="">كل المصادر</option>{handles.map((t) => <option key={t} value={t}>@{t}</option>)}</select>
        <select value={day} onChange={(e) => setDay(e.target.value)}><option value="">كل التواريخ</option>{dates.map((d) => <option key={d} value={d}>{d}</option>)}</select>
        <select value={vote} onChange={(e) => setVote(e.target.value)}><option value="">إعجاب: الكل</option><option value="like">👍 عجبني</option><option value="dislike">👎 لأ</option><option value="unrated">لسه</option></select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">كل الحالات</option>{['draft', 'approved', 'shot', 'posted', 'rejected'].map((s) => <option key={s} value={s}>{s}</option>)}</select>
        <select value={sort} onChange={(e) => setSort(e.target.value)}><option value="id">الأقدم</option><option value="-id">الأحدث</option><option value="-length_s">الأطول</option></select>
        <button className="reset" onClick={reset}>مسح</button>
      </div>

      <div className="count">عرض {rows.length} من {scripts.length}</div>

      {rows.length === 0 ? <div className="empty">مفيش نتايج.</div> : rows.map((r) => {
        const myVote = fb[r.id]?.vote
        return (
          <div className={`card ${myVote === 'dislike' ? 'card-dislike' : myVote === 'like' ? 'card-like' : ''}`} key={r.id}>
            <h2><span className="num">{r.id}</span> {r.title_ar}<span className="en">{r.title_en}</span></h2>
            <div className="badges">
              {r.product && <span className="b b-prod">🛍️ {r.product}</span>}
              {r.funnel && <span className={`b b-fn ${r.funnel}`}>{r.funnel}</span>}
              {r.batch && <span className="b b-batch">{r.batch}</span>}
              <span className="b b-len">~{r.length_s || 80}s</span>
              <span className={`b b-st ${r.status}`}>{r.status}</span>
              {r.content_type && <span className="b b-type">{r.content_type}</span>}
              {r.hook_type && <span className="b b-hook">هوك: {r.hook_type}</span>}
              {r.source_handle && <span className="b b-insp">@{r.source_handle}</span>}
              {r.created_at && <span className="b b-date">{r.created_at.slice(0, 10)}</span>}
            </div>
            <div className="label l-hook">الهوك</div><div className="hook">{r.hook}</div>
            <div className="label l-vo">الكلام</div><div className="vo">{r.vo}</div>
            <div className="label l-cta">الـCTA</div><div className="cta">{r.cta}</div>
            <div className="label l-cap">الكابشن</div><div className="cap">{r.caption}<span className="tags">{r.hashtags}</span></div>
            <div className="fb">
              <button className={`vote up ${myVote === 'like' ? 'on' : ''}`} onClick={() => setVoteFor(r.id, 'like')}>👍 عجبني</button>
              <button className={`vote down ${myVote === 'dislike' ? 'on' : ''}`} onClick={() => setVoteFor(r.id, 'dislike')}>👎 مش عاجبني</button>
              <textarea className="note" placeholder="اكتب هنا إيه اللي وحش عشان أحسّنه المرة الجاية…"
                value={fb[r.id]?.note || ''} onChange={(e) => setNoteFor(r.id, e.target.value)} />
            </div>
          </div>
        )
      })}
      <div className="foot">🦞 PrimeClaw · React + Vite · لايك/نوت متسجّل في المتصفح — صدّره وابعتهولي</div>
    </div>
  )
}
