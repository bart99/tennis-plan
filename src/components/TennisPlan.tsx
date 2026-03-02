import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

type UserName = '성호' | '윤희'

type Schedule = {
  id: string
  date: string
  start_time?: string
  end_time?: string
  court?: string
  note?: string
  match_id?: string
}

type SetScore = { sungho: number; yunhee: number }

type Match = {
  id: string
  schedule_id: string
  date: string
  sets: SetScore[]
  comment_sungho?: string
  comment_yunhee?: string
}

type BookingSite = {
  id: string
  name: string
  url: string
}

const HOURS = ['06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22'] as const

function ds(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtDate(s: string) {
  const [, m, d] = s.split('-')
  return `${parseInt(m)}월 ${parseInt(d)}일`
}

function gid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function setScoreLabel(sets: SetScore[]) {
  return sets.length === 0 ? '-' : sets.map((s) => `${s.sungho}-${s.yunhee}`).join(' / ')
}

function matchWinner(sets: SetScore[]): UserName | '무승부' | null {
  if (!sets.length) return null
  let a = 0, b = 0
  for (const s of sets) { if (s.sungho > s.yunhee) a++; else if (s.yunhee > s.sungho) b++ }
  return a > b ? '성호' : b > a ? '윤희' : '무승부'
}

type CDay = { date: Date; cur: boolean; hasSched: boolean; hasMatch: boolean }

function monthGrid(md: Date, scheds: Schedule[], matches: Match[]): CDay[] {
  const y = md.getFullYear(), mo = md.getMonth()
  const f = new Date(y, mo, 1), st = new Date(f)
  st.setDate(f.getDate() - f.getDay())
  const sd = new Set(scheds.map((s) => s.date))
  const md2 = new Set(matches.map((m) => m.date))
  const days: CDay[] = []
  for (let i = 0; i < 42; i++) {
    const c = new Date(st); c.setDate(st.getDate() + i)
    const d = ds(c)
    days.push({ date: c, cur: c.getMonth() === mo, hasSched: sd.has(d), hasMatch: md2.has(d) })
  }
  return days
}

export default function TennisPlan() {
  const today = useMemo(() => new Date(), [])
  const [user, setUser] = useState<UserName>(() => {
    try {
      const saved = localStorage.getItem('tp-user')
      if (saved === '"성호"' || saved === '"윤희"') return JSON.parse(saved)
    } catch { /* */ }
    return '성호'
  })
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [sites, setSites] = useState<BookingSite[]>([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [sel, setSel] = useState(() => ds(today))
  const [sitesOpen, setSitesOpen] = useState(false)

  type Panel = null | 'schedule' | 'match'
  const [panel, setPanel] = useState<Panel>(null)

  const [sf, setSf] = useState({ id: '', date: '', startTime: '', endTime: '', court: '', note: '' })
  const [courtDd, setCourtDd] = useState(false)

  const [mSchedId, setMSchedId] = useState('')
  const [mEditId, setMEditId] = useState<string | null>(null)
  const [mSets, setMSets] = useState<SetScore[]>([{ sungho: 0, yunhee: 0 }])
  const [mCommentS, setMCommentS] = useState('')
  const [mCommentY, setMCommentY] = useState('')

  const [siteForm, setSiteForm] = useState({ name: '', url: '' })

  // ─── 초기 데이터 로드 ───
  useEffect(() => {
    async function load() {
      const [sRes, mRes, bRes] = await Promise.all([
        supabase.from('schedules').select('*').order('date'),
        supabase.from('matches').select('*').order('date'),
        supabase.from('booking_sites').select('*').order('created_at'),
      ])
      if (sRes.data) setSchedules(sRes.data)
      if (mRes.data) setMatches(mRes.data)
      if (bRes.data) setSites(bRes.data)
      setLoading(false)
    }
    load()
  }, [])

  // 사용자 선택은 브라우저에 저장
  useEffect(() => {
    try { localStorage.setItem('tp-user', JSON.stringify(user)) } catch { /* */ }
  }, [user])

  const grid = useMemo(() => monthGrid(month, schedules, matches), [month, schedules, matches])
  const ml = `${month.getFullYear()}년 ${month.getMonth() + 1}월`

  const daySch = useMemo(() => schedules.filter((s) => s.date === sel).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || '')), [schedules, sel])

  const matchForSchedule = useCallback((schedId: string) => matches.find((m) => m.schedule_id === schedId), [matches])

  const selectDate = useCallback((d: Date) => { setSel(ds(d)); setPanel(null) }, [])

  // ─── 일정 CRUD ───
  const openSchedForm = (s?: Schedule) => {
    setSf({
      id: s?.id ?? '',
      date: s?.date ?? sel,
      startTime: s?.start_time ?? '',
      endTime: s?.end_time ?? '',
      court: s?.court ?? '',
      note: s?.note ?? '',
    })
    setPanel('schedule')
  }

  const saveSched = async () => {
    const id = sf.id || gid()
    const row = {
      id,
      date: sf.date || sel,
      start_time: sf.startTime || null,
      end_time: sf.endTime || null,
      court: sf.court || null,
      note: sf.note || null,
    }

    if (sf.id) {
      const { data } = await supabase.from('schedules').update(row).eq('id', sf.id).select().single()
      if (data) setSchedules((p) => p.map((s) => s.id === sf.id ? data : s))
    } else {
      const { data } = await supabase.from('schedules').insert(row).select().single()
      if (data) setSchedules((p) => [...p, data])
    }
    setPanel(null)
  }

  const deleteSched = async (id: string) => {
    await supabase.from('matches').delete().eq('schedule_id', id)
    await supabase.from('schedules').delete().eq('id', id)
    setSchedules((p) => p.filter((s) => s.id !== id))
    setMatches((p) => p.filter((m) => m.schedule_id !== id))
  }

  // ─── 경기 CRUD ───
  const openMatchForm = (schedId: string, existing?: Match) => {
    setMSchedId(schedId)
    setMEditId(existing?.id ?? null)
    setMSets(existing?.sets?.length ? existing.sets.map((s) => ({ ...s })) : [{ sungho: 0, yunhee: 0 }])
    setMCommentS(existing?.comment_sungho ?? '')
    setMCommentY(existing?.comment_yunhee ?? '')
    setPanel('match')
  }

  const updSet = (i: number, p: 'sungho' | 'yunhee', d: number) => {
    setMSets((prev) => prev.map((s, j) => j === i ? { ...s, [p]: Math.max(0, s[p] + d) } : s))
  }

  const saveMatchResult = async () => {
    if (!mSets.some((s) => s.sungho > 0 || s.yunhee > 0)) return
    const id = mEditId ?? gid()
    const row = {
      id,
      schedule_id: mSchedId,
      date: sel,
      sets: mSets,
      comment_sungho: mCommentS || null,
      comment_yunhee: mCommentY || null,
    }

    if (mEditId) {
      const { data } = await supabase.from('matches').update(row).eq('id', mEditId).select().single()
      if (data) setMatches((p) => p.map((m) => m.id === mEditId ? data : m))
    } else {
      const { data } = await supabase.from('matches').insert(row).select().single()
      if (data) setMatches((p) => [...p, data])
    }

    await supabase.from('schedules').update({ match_id: id }).eq('id', mSchedId)
    setSchedules((p) => p.map((s) => s.id === mSchedId ? { ...s, match_id: id } : s))
    setPanel(null)
  }

  const deleteMatchResult = async (matchId: string, schedId: string) => {
    await supabase.from('matches').delete().eq('id', matchId)
    await supabase.from('schedules').update({ match_id: null }).eq('id', schedId)
    setMatches((p) => p.filter((m) => m.id !== matchId))
    setSchedules((p) => p.map((s) => s.id === schedId ? { ...s, match_id: undefined } : s))
  }

  // ─── 사이트 CRUD ───
  const addSite = async () => {
    if (!siteForm.name.trim() || !siteForm.url.trim()) return
    const row = { id: gid(), name: siteForm.name.trim(), url: siteForm.url.trim() }
    const { data } = await supabase.from('booking_sites').insert(row).select().single()
    if (data) setSites((p) => [...p, data])
    setSiteForm({ name: '', url: '' })
  }

  const delSite = async (id: string) => {
    await supabase.from('booking_sites').delete().eq('id', id)
    setSites((p) => p.filter((s) => s.id !== id))
  }

  const wd = ['일', '월', '화', '수', '목', '금', '토']

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-emerald-50 to-white">
        <p className="text-sm text-slate-500">로딩 중...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50 to-white text-slate-900">
      <div className="mx-auto max-w-lg px-4 pb-12 pt-5">

        {/* ─── 헤더 ─── */}
        <header className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-emerald-700 sm:text-2xl">테니스 플랜</h1>
          <div className="flex items-center gap-1 rounded-xl bg-white p-1 shadow-sm ring-1 ring-emerald-100">
            {(['성호', '윤희'] as UserName[]).map((u) => (
              <button key={u} onClick={() => setUser(u)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${user === u ? 'bg-emerald-500 text-white shadow' : 'text-slate-500 active:bg-emerald-50'}`}>
                {u}
              </button>
            ))}
          </div>
        </header>

        {/* ─── 예약 사이트 바로가기 (접기/펴기) ─── */}
        <section className="mb-4 rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
          <button onClick={() => setSitesOpen(!sitesOpen)}
            className="flex w-full items-center justify-between px-4 py-3 text-left">
            <span className="text-sm font-semibold text-slate-800">예약 사이트 바로가기</span>
            <span className="text-xs text-slate-400">{sitesOpen ? '접기 ▲' : '펴기 ▼'}</span>
          </button>
          {sitesOpen && (
            <div className="border-t border-slate-100 px-4 pb-3 pt-2">
              {sites.length === 0 ? (
                <p className="py-2 text-xs text-slate-400">등록된 사이트가 없습니다. 아래에서 추가하세요.</p>
              ) : (
                <div className="mb-3 flex flex-wrap gap-2">
                  {sites.map((s) => (
                    <div key={s.id} className="flex items-center gap-1">
                      <a href={s.url} target="_blank" rel="noreferrer"
                        className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 active:bg-emerald-100">
                        {s.name} ↗
                      </a>
                      <button onClick={() => delSite(s.id)}
                        className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] text-slate-400 hover:bg-red-50 hover:text-red-500">✕</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 text-xs">
                <input type="text" placeholder="사이트명" value={siteForm.name} onChange={(e) => setSiteForm((p) => ({ ...p, name: e.target.value }))}
                  className="flex-1 rounded-lg border border-slate-200 px-2.5 py-2 outline-none focus:border-emerald-400" />
                <input type="url" placeholder="https://..." value={siteForm.url} onChange={(e) => setSiteForm((p) => ({ ...p, url: e.target.value }))}
                  className="flex-[2] rounded-lg border border-slate-200 px-2.5 py-2 outline-none focus:border-emerald-400" />
                <button onClick={addSite} className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-white active:bg-emerald-600">추가</button>
              </div>
            </div>
          )}
        </section>

        {/* ─── 캘린더 ─── */}
        <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <div className="mb-3 flex items-center justify-between">
            <button onClick={() => setMonth((p) => new Date(p.getFullYear(), p.getMonth() - 1, 1))}
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 active:bg-slate-100">◀</button>
            <span className="text-sm font-bold text-slate-800">{ml}</span>
            <button onClick={() => setMonth((p) => new Date(p.getFullYear(), p.getMonth() + 1, 1))}
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 active:bg-slate-100">▶</button>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-100">
            <div className="grid grid-cols-7 bg-slate-50 text-center text-[11px] font-semibold text-slate-500">
              {wd.map((w, i) => (<div key={w} className={`py-2 ${i === 0 ? 'text-rose-400' : i === 6 ? 'text-blue-400' : ''}`}>{w}</div>))}
            </div>
            <div className="grid grid-cols-7 bg-white">
              {grid.map((day, di) => {
                const d = ds(day.date)
                const isT = d === ds(today)
                const isS = d === sel
                const dow = di % 7
                return (
                  <button key={d} onClick={() => selectDate(day.date)}
                    className={`relative flex h-12 flex-col items-center justify-center border-t border-slate-50 text-xs transition-all sm:h-14
                      ${day.cur ? '' : 'text-slate-300'}
                      ${dow === 0 && day.cur ? 'text-rose-500' : ''}
                      ${dow === 6 && day.cur ? 'text-blue-500' : ''}
                      ${isS ? 'bg-emerald-50 ring-2 ring-inset ring-emerald-400' : 'active:bg-emerald-50/60'}`}>
                    <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[12px] sm:text-[13px]
                      ${isT ? 'bg-emerald-500 text-white font-bold' : 'font-medium'}`}>
                      {day.date.getDate()}
                    </span>
                    <div className="absolute bottom-1 flex gap-0.5">
                      {day.hasSched && <span className="h-1 w-1 rounded-full bg-emerald-400" />}
                      {day.hasMatch && <span className="h-1 w-1 rounded-full bg-sky-400" />}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-400">
            <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" /> 일정</span>
            <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-400" /> 경기 기록</span>
          </div>
        </section>

        {/* ─── 선택 날짜 상세 ─── */}
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-800">{fmtDate(sel)}</h2>
            {panel === null && (
              <button onClick={() => openSchedForm()}
                className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-sm active:bg-emerald-600">+ 일정 등록</button>
            )}
            {panel !== null && (
              <button onClick={() => setPanel(null)}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 active:bg-slate-50">← 돌아가기</button>
            )}
          </div>

          {/* 상세 보기 */}
          {panel === null && (
            <div className="space-y-3">
              {daySch.length === 0 && (
                <p className="py-6 text-center text-sm text-slate-400">등록된 일정이 없어요.</p>
              )}
              {daySch.map((s) => {
                const m = matchForSchedule(s.id)
                const w = m ? matchWinner(m.sets) : null
                return (
                  <div key={s.id} className="rounded-2xl border border-slate-100 bg-slate-50/50 p-3">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-bold text-slate-900">{s.court || '장소 미정'}</span>
                          {(s.start_time || s.end_time) && (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                              {s.start_time?.replace(':00', '시')} ~ {s.end_time?.replace(':00', '시')}
                            </span>
                          )}
                        </div>
                        {s.note && <p className="mt-1 text-xs text-slate-500">{s.note}</p>}
                      </div>
                      <div className="ml-2 flex shrink-0 gap-1 text-[11px]">
                        <button onClick={() => openSchedForm(s)} className="rounded-lg px-2 py-1 text-slate-500 active:bg-slate-100">수정</button>
                        <button onClick={() => deleteSched(s.id)} className="rounded-lg px-2 py-1 text-red-400 active:bg-red-50">삭제</button>
                      </div>
                    </div>
                    <div className="mt-2 border-t border-slate-100 pt-2">
                      {m ? (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900">{setScoreLabel(m.sets)}</span>
                            {w && w !== '무승부' && (
                              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${w === user ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                {w === user ? '승' : '패'}
                              </span>
                            )}
                            {w === '무승부' && <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-[11px] font-bold text-slate-600">무승부</span>}
                          </div>
                          <div className="flex gap-1 text-[11px]">
                            <button onClick={() => openMatchForm(s.id, m)} className="rounded-lg px-2 py-1 text-slate-500 active:bg-slate-100">수정</button>
                            <button onClick={() => deleteMatchResult(m.id, s.id)} className="rounded-lg px-2 py-1 text-red-400 active:bg-red-50">삭제</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => openMatchForm(s.id)}
                          className="w-full rounded-xl border border-dashed border-sky-300 bg-sky-50/50 py-2.5 text-xs font-semibold text-sky-600 active:bg-sky-100">
                          결과 기록하기
                        </button>
                      )}
                      {(m?.comment_sungho || m?.comment_yunhee) && (
                        <div className="mt-1.5 space-y-0.5">
                          {m.comment_sungho && <p className="text-[11px] text-slate-500"><span className="font-semibold text-emerald-600">성호:</span> {m.comment_sungho}</p>}
                          {m.comment_yunhee && <p className="text-[11px] text-slate-500"><span className="font-semibold text-sky-600">윤희:</span> {m.comment_yunhee}</p>}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ─── 일정 등록 폼 ─── */}
          {panel === 'schedule' && (
            <div className="space-y-3">
              <div className="grid grid-cols-[auto,1fr] items-center gap-x-3 gap-y-3">
                <span className="text-xs font-medium text-slate-600">날짜</span>
                <input type="date" value={sf.date} onChange={(e) => setSf((p) => ({ ...p, date: e.target.value }))}
                  className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-400" />

                <span className="text-xs font-medium text-slate-600">시간</span>
                <div className="flex items-center gap-2">
                  <select value={sf.startTime ? sf.startTime.slice(0, 2) : ''}
                    onChange={(e) => setSf((p) => ({ ...p, startTime: e.target.value ? `${e.target.value}:00` : '' }))}
                    className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-400">
                    <option value="">시작</option>
                    {HOURS.map((h) => <option key={h} value={h}>{h}시</option>)}
                  </select>
                  <span className="text-slate-400">~</span>
                  <select value={sf.endTime ? sf.endTime.slice(0, 2) : ''}
                    onChange={(e) => setSf((p) => ({ ...p, endTime: e.target.value ? `${e.target.value}:00` : '' }))}
                    className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-400">
                    <option value="">종료</option>
                    {HOURS.map((h) => <option key={h} value={h}>{h}시</option>)}
                  </select>
                </div>

                <span className="text-xs font-medium text-slate-600">장소</span>
                <div className="relative">
                  <input type="text" placeholder="장소명 입력 또는 선택" value={sf.court}
                    onChange={(e) => setSf((p) => ({ ...p, court: e.target.value }))}
                    onFocus={() => setCourtDd(true)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-400" />
                  {courtDd && sites.length > 0 && (
                    <ul className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                      {sites.map((s) => (
                        <li key={s.id}>
                          <button onClick={() => { setSf((p) => ({ ...p, court: s.name })); setCourtDd(false) }}
                            className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm active:bg-emerald-50">
                            <span className="font-medium text-slate-900">{s.name}</span>
                            <a href={s.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                              className="text-xs text-emerald-600">바로가기 ↗</a>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <span className="text-xs font-medium text-slate-600">메모</span>
                <textarea rows={2} placeholder="특이사항" value={sf.note}
                  onChange={(e) => setSf((p) => ({ ...p, note: e.target.value }))}
                  onFocus={() => setCourtDd(false)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-400" />
              </div>
              <button onClick={saveSched}
                className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-bold text-white shadow-sm active:bg-emerald-600">
                {sf.id ? '일정 수정' : '일정 등록'}
              </button>
            </div>
          )}

          {/* ─── 경기 결과 기록 폼 ─── */}
          {panel === 'match' && (
            <div className="space-y-4">
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-700">게임 스코어 입력</h3>
                  <button onClick={() => setMSets((p) => [...p, { sungho: 0, yunhee: 0 }])}
                    className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 active:bg-slate-50">+ 세트 추가</button>
                </div>
                <div className="space-y-2">
                  {mSets.map((s, i) => (
                    <div key={i} className="rounded-2xl bg-slate-50 px-3 py-3">
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-400">세트 {i + 1}</span>
                        {mSets.length > 1 && (
                          <button onClick={() => setMSets((p) => p.filter((_, j) => j !== i))}
                            className="text-[11px] text-red-400 active:text-red-600">삭제</button>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-emerald-700">성호</span>
                          <button onClick={() => updSet(i, 'sungho', -1)}
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-lg font-bold text-slate-500 active:bg-slate-100">−</button>
                          <span className="w-8 text-center text-xl font-black text-slate-900">{s.sungho}</span>
                          <button onClick={() => updSet(i, 'sungho', 1)}
                            className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-emerald-400 text-lg font-bold text-emerald-600 active:bg-emerald-50">+</button>
                        </div>
                        <span className="text-lg font-bold text-slate-300">:</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => updSet(i, 'yunhee', -1)}
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-lg font-bold text-slate-500 active:bg-slate-100">−</button>
                          <span className="w-8 text-center text-xl font-black text-slate-900">{s.yunhee}</span>
                          <button onClick={() => updSet(i, 'yunhee', 1)}
                            className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-sky-400 text-lg font-bold text-sky-600 active:bg-sky-50">+</button>
                          <span className="text-xs font-bold text-sky-700">윤희</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {mSets.some((s) => s.sungho > 0 || s.yunhee > 0) && (
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">세트 스코어</span>
                    <span className="font-bold text-slate-900">{setScoreLabel(mSets)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm">
                    <span className="text-slate-500">결과</span>
                    {(() => {
                      const w = matchWinner(mSets)
                      if (!w) return <span className="text-slate-400">-</span>
                      if (w === '무승부') return <span className="font-bold text-slate-600">무승부</span>
                      return <span className={`font-bold ${w === user ? 'text-emerald-700' : 'text-rose-700'}`}>{w} 승</span>
                    })()}
                  </div>
                </div>
              )}

              <div>
                <span className={`text-xs font-medium ${user === '성호' ? 'text-emerald-700' : 'text-sky-700'}`}>{user} 코멘트</span>
                <textarea rows={2} placeholder="느낀 점, 컨디션 등"
                  value={user === '성호' ? mCommentS : mCommentY}
                  onChange={(e) => user === '성호' ? setMCommentS(e.target.value) : setMCommentY(e.target.value)}
                  className={`mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ${user === '성호' ? 'focus:border-emerald-400' : 'focus:border-sky-400'}`} />
              </div>
              <button onClick={saveMatchResult}
                className="w-full rounded-xl bg-sky-500 py-3 text-sm font-bold text-white shadow-sm active:bg-sky-600">
                {mEditId ? '결과 수정' : '결과 등록'}
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
