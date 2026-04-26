import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type UserName = '성호' | '윤희'
type SportType = 'tennis' | 'golf' | 'running'

type Schedule = {
  id: string
  date: string
  sport?: SportType
  title?: string
  start_time?: string
  end_time?: string
  court?: string
  note?: string
  match_id?: string
  detail_json?: {
    golfScore?: number
    runningDistanceKm?: number
    runningMinutes?: number
    runningPace?: string
  }
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
  url?: string
  sport?: SportType | 'all'
}

const HOURS = ['06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22'] as const
const SPORT_OPTIONS: { value: SportType; label: string; icon: string }[] = [
  { value: 'tennis', label: '테니스', icon: '🎾' },
  { value: 'golf', label: '골프', icon: '⛳' },
  { value: 'running', label: '러닝', icon: '🏃' },
]
const SITE_SPORT_OPTIONS: { value: SportType | 'all'; label: string }[] = [
  { value: 'all', label: '전체 공용' },
  { value: 'tennis', label: '테니스' },
  { value: 'golf', label: '골프' },
  { value: 'running', label: '러닝' },
]

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

function isBagel(s: SetScore) {
  return (s.sungho === 0 && s.yunhee >= 6) || (s.yunhee === 0 && s.sungho >= 6)
}

function setScoreLabel(sets: SetScore[]) {
  if (sets.length === 0) return '-'
  return sets.map((s) => `${s.yunhee}-${s.sungho}${isBagel(s) ? ' 🥯' : ''}`).join(' / ')
}

const TENNIS_EMOJIS = ['🎾', '🥯', '🏆', '🥇', '💪', '🔥', '⚡', '👏', '🙌', '😎', '😤', '😅', '👍', '🎯', '❤️'] as const

async function apiData<T>(body?: unknown): Promise<T> {
  const response = await fetch('/api/data', {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) {
    let message = '서버 요청 실패'
    try {
      const err = await response.json()
      if (typeof err?.error === 'string') message = err.error
    } catch { /* ignore */ }
    throw new Error(message)
  }
  return response.json() as Promise<T>
}

function matchWinner(sets: SetScore[]): UserName | '무승부' | null {
  if (!sets.length) return null
  let a = 0, b = 0
  for (const s of sets) { if (s.sungho > s.yunhee) a++; else if (s.yunhee > s.sungho) b++ }
  return a > b ? '성호' : b > a ? '윤희' : '무승부'
}

function sportValue(s?: Schedule): SportType {
  return s?.sport ?? 'tennis'
}

function sportMeta(s?: Schedule) {
  const sport = sportValue(s)
  return SPORT_OPTIONS.find((v) => v.value === sport) ?? SPORT_OPTIONS[0]
}

function runningPace(distanceKm: number, minutes: number) {
  if (!distanceKm || !minutes || distanceKm <= 0 || minutes <= 0) return ''
  const paceMin = minutes / distanceKm
  const m = Math.floor(paceMin)
  const sec = Math.round((paceMin - m) * 60)
  return `${m}:${String(sec).padStart(2, '0')}/km`
}

function scheduleSummary(s: Schedule) {
  const sport = sportValue(s)
  if (sport === 'golf') {
    const score = s.detail_json?.golfScore
    return score ? `스코어 ${score}타` : '골프 기록'
  }
  if (sport === 'running') {
    const dist = s.detail_json?.runningDistanceKm
    const pace = s.detail_json?.runningPace
    if (dist && pace) return `${dist}km · ${pace}`
    if (dist) return `${dist}km`
    return '러닝 기록'
  }
  if (s.start_time || s.end_time) return `${s.start_time?.replace(':00', '시')} ~ ${s.end_time?.replace(':00', '시')}`
  return '테니스 일정'
}

type DaySched = { court?: string; time?: string }
type DayMatch = { label: string; winner: UserName | '무승부' | null }
type CDay = { date: Date; cur: boolean; scheds: DaySched[]; matches: DayMatch[] }

function monthGrid(md: Date, scheds: Schedule[], matches: Match[]): CDay[] {
  const y = md.getFullYear(), mo = md.getMonth()
  const f = new Date(y, mo, 1), st = new Date(f)
  st.setDate(f.getDate() - f.getDay())
  const schedByDate = new Map<string, Schedule[]>()
  for (const s of scheds) { const arr = schedByDate.get(s.date) ?? []; arr.push(s); schedByDate.set(s.date, arr) }
  const matchByDate = new Map<string, Match[]>()
  for (const m of matches) { const arr = matchByDate.get(m.date) ?? []; arr.push(m); matchByDate.set(m.date, arr) }
  const days: CDay[] = []
  for (let i = 0; i < 42; i++) {
    const c = new Date(st); c.setDate(st.getDate() + i)
    const d = ds(c)
    const ss = (schedByDate.get(d) ?? []).map((s) => ({ court: s.title ?? s.court, time: s.start_time?.slice(0, 2) }))
    const mm = (matchByDate.get(d) ?? []).map((m) => ({ label: setScoreLabel(m.sets), winner: matchWinner(m.sets) }))
    days.push({ date: c, cur: c.getMonth() === mo, scheds: ss, matches: mm })
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
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar')
  const [sportFilter, setSportFilter] = useState<'all' | SportType>('all')

  type Panel = null | 'schedule' | 'match'
  const [panel, setPanel] = useState<Panel>(null)

  const [sf, setSf] = useState({
    id: '',
    date: '',
    sport: 'tennis' as SportType,
    title: '',
    startTime: '',
    endTime: '',
    court: '',
    note: '',
    golfScore: '',
    runningDistanceKm: '',
    runningMinutes: '',
  })
  const [showCourtSuggestions, setShowCourtSuggestions] = useState(false)
  const courtBoxRef = useRef<HTMLDivElement | null>(null)

  const [mSchedId, setMSchedId] = useState('')
  const [mEditId, setMEditId] = useState<string | null>(null)
  const [mSets, setMSets] = useState<SetScore[]>([{ sungho: 0, yunhee: 0 }])
  const [mCommentS, setMCommentS] = useState('')
  const [mCommentY, setMCommentY] = useState('')

  const [siteForm, setSiteForm] = useState<{ name: string; url: string; sport: SportType | 'all' }>({ name: '', url: '', sport: 'tennis' })

  const [dbError, setDbError] = useState('')

  // ─── PWA 설치 ───
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e)
      setShowInstallBanner(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  useEffect(() => {
    const closeOnOutsideTouch = (event: MouseEvent | TouchEvent | PointerEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (courtBoxRef.current && !courtBoxRef.current.contains(target)) {
        setShowCourtSuggestions(false)
      }
    }
    const closeOnFocusMove = (event: FocusEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (courtBoxRef.current && !courtBoxRef.current.contains(target)) {
        setShowCourtSuggestions(false)
      }
    }
    document.addEventListener('mousedown', closeOnOutsideTouch)
    document.addEventListener('touchstart', closeOnOutsideTouch)
    document.addEventListener('pointerdown', closeOnOutsideTouch)
    document.addEventListener('focusin', closeOnFocusMove)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideTouch)
      document.removeEventListener('touchstart', closeOnOutsideTouch)
      document.removeEventListener('pointerdown', closeOnOutsideTouch)
      document.removeEventListener('focusin', closeOnFocusMove)
    }
  }, [])

  const handleInstall = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    const result = await installPrompt.userChoice
    if (result.outcome === 'accepted') {
      setShowInstallBanner(false)
      setInstallPrompt(null)
    }
  }

  // ─── 초기 데이터 로드 ───
  useEffect(() => {
    async function load() {
      try {
        const data = await apiData<{ schedules: Schedule[]; matches: Match[]; bookingSites: BookingSite[] }>()
        setSchedules(data.schedules ?? [])
        setMatches(data.matches ?? [])
        setSites(data.bookingSites ?? [])
      } catch (e) {
        console.error('[api]', e)
        setDbError(e instanceof Error ? e.message : 'DB 연결 실패')
      }
      setLoading(false)
    }
    load()
  }, [])

  // 사용자 선택은 브라우저에 저장
  useEffect(() => {
    try { localStorage.setItem('tp-user', JSON.stringify(user)) } catch { /* */ }
  }, [user])

  const filteredSchedules = useMemo(
    () => sportFilter === 'all' ? schedules : schedules.filter((s) => sportValue(s) === sportFilter),
    [schedules, sportFilter],
  )

  const filteredMatches = useMemo(
    () => sportFilter === 'all' || sportFilter === 'tennis' ? matches : [],
    [matches, sportFilter],
  )

  const grid = useMemo(() => monthGrid(month, filteredSchedules, filteredMatches), [month, filteredSchedules, filteredMatches])
  const ml = `${month.getFullYear()}년 ${month.getMonth() + 1}월`

  const daySch = useMemo(() => filteredSchedules.filter((s) => s.date === sel).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || '')), [filteredSchedules, sel])

  const todayStr = useMemo(() => ds(today), [today])
  const upcomingList = useMemo(() => filteredSchedules.filter((s) => s.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date) || (a.start_time || '').localeCompare(b.start_time || '')), [filteredSchedules, todayStr])
  const pastList = useMemo(() => filteredSchedules.filter((s) => s.date < todayStr).sort((a, b) => b.date.localeCompare(a.date) || (b.start_time || '').localeCompare(a.start_time || '')), [filteredSchedules, todayStr])

  const matchForSchedule = useCallback((schedId: string) => matches.find((m) => m.schedule_id === schedId), [matches])

  const selectDate = useCallback((d: Date) => { setSel(ds(d)); setPanel(null) }, [])

  // ─── 일정 CRUD ───
  const openSchedForm = (s?: Schedule) => {
    const sport = sportValue(s)
    setSf({
      id: s?.id ?? '',
      date: s?.date ?? sel,
      sport,
      title: s?.title ?? (sport === 'tennis' ? '' : s?.court ?? ''),
      startTime: s?.start_time ?? '',
      endTime: s?.end_time ?? '',
      court: s?.court ?? '',
      note: s?.note ?? '',
      golfScore: s?.detail_json?.golfScore ? String(s.detail_json.golfScore) : '',
      runningDistanceKm: s?.detail_json?.runningDistanceKm ? String(s.detail_json.runningDistanceKm) : '',
      runningMinutes: s?.detail_json?.runningMinutes ? String(s.detail_json.runningMinutes) : '',
    })
    setPanel('schedule')
  }

  const saveSched = async () => {
    const id = sf.id || gid()
    const detail = {
      golfScore: sf.golfScore ? Number(sf.golfScore) : undefined,
      runningDistanceKm: sf.runningDistanceKm ? Number(sf.runningDistanceKm) : undefined,
      runningMinutes: sf.runningMinutes ? Number(sf.runningMinutes) : undefined,
    }
    const pace = detail.runningDistanceKm && detail.runningMinutes
      ? runningPace(detail.runningDistanceKm, detail.runningMinutes)
      : undefined
    const row = {
      id,
      date: sf.date || sel,
      sport: sf.sport,
      title: sf.title || (sf.sport === 'tennis' ? null : sf.court || null),
      start_time: sf.sport === 'tennis' ? (sf.startTime || null) : null,
      end_time: sf.sport === 'tennis' ? (sf.endTime || null) : null,
      court: sf.court || null,
      note: sf.note || null,
      match_id: sf.id ? schedules.find((s) => s.id === sf.id)?.match_id ?? null : null,
      detail_json: sf.sport === 'golf'
        ? { golfScore: detail.golfScore }
        : sf.sport === 'running'
          ? { runningDistanceKm: detail.runningDistanceKm, runningMinutes: detail.runningMinutes, runningPace: pace }
          : {},
    }
    const result = await apiData<{ row: Schedule }>({ entity: 'schedules', action: 'upsert', payload: row })
    const data = result.row
    if (sf.id) setSchedules((p) => p.map((s) => s.id === sf.id ? data : s))
    else setSchedules((p) => [...p, data])
    setPanel(null)
  }

  const deleteSched = async (id: string) => {
    await apiData({ entity: 'schedules', action: 'delete', payload: { id } })
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

    const result = await apiData<{ row: Match }>({ entity: 'matches', action: 'upsert', payload: row })
    const data = result.row
    if (mEditId) setMatches((p) => p.map((m) => m.id === mEditId ? data : m))
    else setMatches((p) => [...p, data])

    await apiData({ entity: 'schedules', action: 'setMatchId', payload: { id: mSchedId, match_id: id } })
    setSchedules((p) => p.map((s) => s.id === mSchedId ? { ...s, match_id: id } : s))
    setPanel(null)
  }

  const deleteMatchResult = async (matchId: string, schedId: string) => {
    await apiData({ entity: 'matches', action: 'delete', payload: { id: matchId } })
    await apiData({ entity: 'schedules', action: 'setMatchId', payload: { id: schedId, match_id: null } })
    setMatches((p) => p.filter((m) => m.id !== matchId))
    setSchedules((p) => p.map((s) => s.id === schedId ? { ...s, match_id: undefined } : s))
  }

  // ─── 사이트 CRUD ───
  const addSite = async () => {
    if (!siteForm.name.trim()) return
    const row = { id: gid(), name: siteForm.name.trim(), url: siteForm.url.trim() || null, sport: siteForm.sport }
    const { row: data } = await apiData<{ row: BookingSite }>({ entity: 'booking_sites', action: 'upsert', payload: row })
    if (data) setSites((p) => [...p, data])
    setSiteForm({ name: '', url: '', sport: siteForm.sport })
  }

  const delSite = async (id: string) => {
    await apiData({ entity: 'booking_sites', action: 'delete', payload: { id } })
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

  if (dbError) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gradient-to-b from-emerald-50 to-white px-6">
        <p className="text-base font-bold text-red-600">DB 연결 오류</p>
        <p className="text-center text-sm text-slate-600">{dbError}</p>
        <button onClick={() => location.reload()} className="mt-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white">다시 시도</button>
      </main>
    )
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-gradient-to-b from-emerald-50 to-white text-slate-900">
      <div className="mx-auto max-w-lg px-4 pb-12 pt-5">

        {/* ─── 헤더 ─── */}
        <header className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-emerald-700 sm:text-2xl">테니스 플랜</h1>
          <div className="flex items-center gap-1 rounded-xl bg-white p-1 shadow-sm ring-1 ring-emerald-100">
            {(['윤희', '성호'] as UserName[]).map((u) => (
              <button key={u} onClick={() => setUser(u)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${user === u ? 'bg-emerald-500 text-white shadow' : 'text-slate-500 active:bg-emerald-50'}`}>
                {u}
              </button>
            ))}
          </div>
        </header>

        {/* ─── PWA 설치 배너 ─── */}
        {showInstallBanner && (
          <div className="mb-4 flex items-center justify-between rounded-2xl bg-emerald-600 px-4 py-3 text-white shadow-sm">
            <div>
              <p className="text-sm font-bold">앱으로 설치하기</p>
              <p className="text-[11px] text-emerald-100">홈 화면에 추가하면 더 빠르게 사용할 수 있어요</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowInstallBanner(false)}
                className="rounded-lg px-2 py-1 text-xs text-emerald-200 active:text-white">닫기</button>
              <button onClick={handleInstall}
                className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-emerald-700 shadow active:bg-emerald-50">설치</button>
            </div>
          </div>
        )}

        {/* ─── 장소 목록 (접기/펴기) ─── */}
        <section className="mb-4 rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
          <button onClick={() => setSitesOpen(!sitesOpen)}
            className="flex w-full items-center justify-between px-4 py-3 text-left">
            <span className="text-sm font-semibold text-slate-800">장소 목록</span>
            <span className="text-xs text-slate-400">{sitesOpen ? '접기 ▲' : '펴기 ▼'}</span>
          </button>
          {sitesOpen && (
            <div className="border-t border-slate-100 px-4 pb-3 pt-2">
              {sites.length === 0 ? (
                <p className="py-2 text-xs text-slate-400">등록된 장소가 없습니다. 아래에서 추가하세요.</p>
              ) : (
                <div className="mb-3 flex flex-wrap gap-2">
                  {sites.map((s) => (
                    <div key={s.id} className="flex items-center gap-1">
                      {s.url ? (
                        <a href={s.url} target="_blank" rel="noreferrer"
                          className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 active:bg-emerald-100">
                          {s.name} {(s.sport && s.sport !== 'all') ? `· ${sportMeta({ sport: s.sport } as Schedule).label}` : '· 전체'} ↗
                        </a>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                          {s.name} {(s.sport && s.sport !== 'all') ? `· ${sportMeta({ sport: s.sport } as Schedule).label}` : '· 전체'}
                        </span>
                      )}
                      <button onClick={() => delSite(s.id)}
                        className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] text-slate-400 hover:bg-red-50 hover:text-red-500">✕</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-2 text-xs">
                <select value={siteForm.sport} onChange={(e) => setSiteForm((p) => ({ ...p, sport: e.target.value as SportType | 'all' }))}
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-2 outline-none focus:border-emerald-400">
                  {SITE_SPORT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
                <div className="flex gap-2">
                  <input type="text" placeholder="장소명" value={siteForm.name} onChange={(e) => setSiteForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-1/3 min-w-0 rounded-lg border border-slate-200 px-2.5 py-2 outline-none focus:border-emerald-400" />
                  <input type="url" placeholder="URL (선택)" value={siteForm.url} onChange={(e) => setSiteForm((p) => ({ ...p, url: e.target.value }))}
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 py-2 outline-none focus:border-emerald-400" />
                </div>
                <button onClick={addSite} className="w-full rounded-lg bg-emerald-500 py-2 text-xs font-bold text-white active:bg-emerald-600">추가</button>
              </div>
            </div>
          )}
        </section>

        {/* ─── 뷰 토글 ─── */}
        <div className="mb-3 flex items-center justify-center">
          <div className="flex items-center gap-1 rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-100">
            <button onClick={() => setViewMode('calendar')}
              className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${viewMode === 'calendar' ? 'bg-emerald-500 text-white shadow' : 'text-slate-500 active:bg-emerald-50'}`}>
              캘린더
            </button>
            <button onClick={() => setViewMode('list')}
              className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${viewMode === 'list' ? 'bg-emerald-500 text-white shadow' : 'text-slate-500 active:bg-emerald-50'}`}>
              목록
            </button>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          {([{ value: 'all', label: '전체', icon: '📋' }, ...SPORT_OPTIONS] as const).map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setSportFilter(f.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${sportFilter === f.value ? 'bg-emerald-500 text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200'}`}
            >
              {f.icon} {f.label}
            </button>
          ))}
        </div>

        {/* ─── 캘린더 ─── */}
        {viewMode === 'calendar' && (
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
                const hasSched = day.scheds.length > 0
                const hasMatch = day.matches.length > 0
                const firstSched = day.scheds[0]
                const firstMatch = day.matches[0]
                return (
                  <button key={d} onClick={() => selectDate(day.date)}
                    className={`relative flex min-h-[3.5rem] flex-col items-center border-t border-slate-50 px-0.5 pb-1 pt-1 text-xs transition-all sm:min-h-[4.2rem]
                      ${day.cur ? '' : 'text-slate-300'}
                      ${dow === 0 && day.cur ? 'text-rose-500' : ''}
                      ${dow === 6 && day.cur ? 'text-blue-500' : ''}
                      ${isS ? 'bg-emerald-50 ring-2 ring-inset ring-emerald-400' : 'active:bg-emerald-50/60'}`}>
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] sm:text-[12px]
                      ${isT ? 'bg-emerald-500 text-white font-bold' : 'font-medium'}`}>
                      {day.date.getDate()}
                    </span>
                    {day.cur && hasSched && (
                      <span className="mt-0.5 w-full truncate text-center text-[8px] font-semibold leading-tight text-emerald-700 sm:text-[9px]">
                        {firstSched.time ? `${firstSched.time}시` : ''}{firstSched.court ? ` ${firstSched.court.slice(0, 3)}` : ' 일정'}
                        {day.scheds.length > 1 ? ` +${day.scheds.length - 1}` : ''}
                      </span>
                    )}
                    {day.cur && hasMatch && (
                      <span className={`mt-0.5 w-full truncate text-center text-[8px] font-bold leading-tight sm:text-[9px] ${
                        firstMatch.winner === user ? 'text-emerald-600' : firstMatch.winner && firstMatch.winner !== '무승부' ? 'text-rose-500' : 'text-sky-600'
                      }`}>
                        {firstMatch.label}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-400">
            <span className="flex items-center gap-1"><span className="font-bold text-emerald-600">10시 OO</span> 일정</span>
            <span className="flex items-center gap-1"><span className="font-bold text-sky-600">6-4</span> 경기 결과</span>
          </div>
        </section>
        )}

        {/* ─── 목록 뷰 ─── */}
        {viewMode === 'list' && (
        <section className="mb-4 space-y-4">
          {/* 예정 일정 */}
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <h3 className="mb-3 text-sm font-bold text-emerald-700">예정 일정</h3>
            {upcomingList.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">예정된 일정이 없어요.</p>
            ) : (
              <div className="space-y-2">
                {upcomingList.map((s) => {
                  const dateObj = new Date(s.date + 'T00:00:00')
                  const dow = wd[dateObj.getDay()]
                  const m = matchForSchedule(s.id)
                  const w = m ? matchWinner(m.sets) : null
                  return (
                    <button key={s.id} onClick={() => { setSel(s.date); setViewMode('calendar'); setPanel(null) }}
                      className="flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-left active:bg-emerald-50/60">
                      <div className="flex flex-col items-center">
                        <span className="text-lg font-black text-slate-900">{dateObj.getDate()}</span>
                        <span className="text-[10px] font-semibold text-slate-400">{dow}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                            {sportMeta(s).icon} {sportMeta(s).label}
                          </span>
                          <span className="text-sm font-bold text-slate-900">{s.title || s.court || '일정'}</span>
                          {s.date === todayStr && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">오늘</span>}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
                          <span>{fmtDate(s.date)}</span>
                          <span>{scheduleSummary(s)}</span>
                        </div>
                      </div>
                      {sportValue(s) === 'tennis' && m && (
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-xs font-bold text-slate-700">{setScoreLabel(m.sets)}</span>
                          {w && w !== '무승부' && (
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${w === user ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                              {w === user ? '승' : '패'}
                            </span>
                          )}
                          {w === '무승부' && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">무승부</span>}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* 지난 기록 */}
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <h3 className="mb-3 text-sm font-bold text-slate-500">지난 기록</h3>
            {pastList.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">지난 기록이 없어요.</p>
            ) : (
              <div className="space-y-2">
                {pastList.map((s) => {
                  const dateObj = new Date(s.date + 'T00:00:00')
                  const dow = wd[dateObj.getDay()]
                  const m = matchForSchedule(s.id)
                  const w = m ? matchWinner(m.sets) : null
                  return (
                    <button key={s.id} onClick={() => { setSel(s.date); setViewMode('calendar'); setPanel(null) }}
                      className="flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-left active:bg-emerald-50/60">
                      <div className="flex flex-col items-center">
                        <span className="text-lg font-black text-slate-400">{dateObj.getDate()}</span>
                        <span className="text-[10px] font-semibold text-slate-300">{dow}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                            {sportMeta(s).icon} {sportMeta(s).label}
                          </span>
                          <span className="text-sm font-bold text-slate-700">{s.title || s.court || '일정'}</span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
                          <span>{fmtDate(s.date)}</span>
                          <span>{scheduleSummary(s)}</span>
                        </div>
                      </div>
                      {sportValue(s) === 'tennis' && m ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-xs font-bold text-slate-600">{setScoreLabel(m.sets)}</span>
                          {w && w !== '무승부' && (
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${w === user ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                              {w === user ? '승' : '패'}
                            </span>
                          )}
                          {w === '무승부' && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">무승부</span>}
                        </div>
                      ) : sportValue(s) === 'tennis' ? (
                        <span className="text-[11px] text-slate-300">결과 없음</span>
                      ) : (
                        <span className="text-[11px] text-slate-400">{scheduleSummary(s)}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </section>
        )}

        {/* ─── 선택 날짜 상세 ─── */}
        {viewMode === 'calendar' && (
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
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                            {sportMeta(s).icon} {sportMeta(s).label}
                          </span>
                          <span className="text-sm font-bold text-slate-900">{s.title || s.court || '일정'}</span>
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                            {scheduleSummary(s)}
                          </span>
                        </div>
                        {s.note && <p className="mt-1 text-xs text-slate-500">{s.note}</p>}
                      </div>
                      <div className="ml-2 flex shrink-0 gap-1 text-[11px]">
                        <button onClick={() => openSchedForm(s)} className="rounded-lg px-2 py-1 text-slate-500 active:bg-slate-100">수정</button>
                        <button onClick={() => deleteSched(s.id)} className="rounded-lg px-2 py-1 text-red-400 active:bg-red-50">삭제</button>
                      </div>
                    </div>
                    <div className="mt-2 border-t border-slate-100 pt-2">
                      {sportValue(s) === 'tennis' && m ? (
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
                      ) : sportValue(s) === 'tennis' ? (
                        <button onClick={() => openMatchForm(s.id)}
                          className="w-full rounded-xl border border-dashed border-sky-300 bg-sky-50/50 py-2.5 text-xs font-semibold text-sky-600 active:bg-sky-100">
                          결과 기록하기
                        </button>
                      ) : (
                        <p className="text-xs text-slate-500">기록: {scheduleSummary(s)}</p>
                      )}
                      {sportValue(s) === 'tennis' && (m?.comment_sungho || m?.comment_yunhee) && (
                        <div className="mt-1.5 space-y-0.5">
                          {m.comment_yunhee && <p className="text-[11px] text-slate-500"><span className="font-semibold text-sky-600">윤희:</span> {m.comment_yunhee}</p>}
                          {m.comment_sungho && <p className="text-[11px] text-slate-500"><span className="font-semibold text-emerald-600">성호:</span> {m.comment_sungho}</p>}
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
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">종목</label>
                <div className="grid grid-cols-3 gap-2">
                  {SPORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSf((p) => ({ ...p, sport: opt.value }))}
                      className={`rounded-xl border px-2 py-2 text-xs font-bold ${sf.sport === opt.value ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500'}`}
                    >
                      {opt.icon} {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">날짜</label>
                <input type="date" value={sf.date} onChange={(e) => setSf((p) => ({ ...p, date: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-400" />
              </div>

              {sf.sport === 'tennis' && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">시간</label>
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
                </div>
              )}

              <div ref={courtBoxRef} className="relative">
                <label className="mb-1 block text-xs font-medium text-slate-600">{sf.sport === 'golf' ? '코스/장소' : '장소'}</label>
                <input type="text" placeholder={sf.sport === 'running' ? '러닝 코스/장소' : '장소명 입력 또는 선택'} value={sf.court}
                  onChange={(e) => setSf((p) => ({ ...p, court: e.target.value }))}
                  onFocus={() => setShowCourtSuggestions(sf.sport === 'tennis')}
                  onBlur={() => setTimeout(() => setShowCourtSuggestions(false), 120)}
                  onKeyDown={(e) => { if (e.key === 'Escape') setShowCourtSuggestions(false) }}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-400" />
                <p className="mt-1 text-[11px] text-slate-400">
                  직접 입력 기본, 아래 목록은 선택한 종목 기준 빠른 선택용
                </p>
                {showCourtSuggestions && sites.some((s) => s.sport === 'all' || s.sport === sf.sport || !s.sport) && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {sites.filter((s) => s.sport === 'all' || s.sport === sf.sport || !s.sport).map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setSf((p) => ({ ...p, court: s.name }))
                          setShowCourtSuggestions(false)
                        }}
                        className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 active:bg-emerald-100"
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {sf.sport === 'golf' && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">스코어(타수)</label>
                  <input
                    type="number"
                    min={1}
                    placeholder="예: 92"
                    value={sf.golfScore}
                    onChange={(e) => setSf((p) => ({ ...p, golfScore: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-400"
                  />
                </div>
              )}

              {sf.sport === 'running' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">거리(km)</label>
                    <input
                      type="number"
                      min={0}
                      step="0.1"
                      placeholder="5"
                      value={sf.runningDistanceKm}
                      onChange={(e) => setSf((p) => ({ ...p, runningDistanceKm: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">시간(분)</label>
                    <input
                      type="number"
                      min={0}
                      placeholder="30"
                      value={sf.runningMinutes}
                      onChange={(e) => setSf((p) => ({ ...p, runningMinutes: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">메모</label>
                <textarea rows={2} placeholder="특이사항" value={sf.note}
                  onChange={(e) => setSf((p) => ({ ...p, note: e.target.value }))}
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
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5">
                          <span className="w-6 text-xs font-bold text-sky-700">윤희</span>
                          <button onClick={() => updSet(i, 'yunhee', -1)}
                            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-base font-bold text-slate-500 active:bg-slate-100">−</button>
                          <span className="w-6 text-center text-lg font-black text-slate-900">{s.yunhee}</span>
                          <button onClick={() => updSet(i, 'yunhee', 1)}
                            className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-sky-400 text-base font-bold text-sky-600 active:bg-sky-50">+</button>
                        </div>
                        <span className="text-base font-bold text-slate-300">:</span>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => updSet(i, 'sungho', -1)}
                            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-base font-bold text-slate-500 active:bg-slate-100">−</button>
                          <span className="w-6 text-center text-lg font-black text-slate-900">{s.sungho}</span>
                          <button onClick={() => updSet(i, 'sungho', 1)}
                            className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-emerald-400 text-base font-bold text-emerald-600 active:bg-emerald-50">+</button>
                          <span className="w-6 text-right text-xs font-bold text-emerald-700">성호</span>
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
                <textarea id="match-comment" rows={2} placeholder="느낀 점, 컨디션 등"
                  value={user === '성호' ? mCommentS : mCommentY}
                  onChange={(e) => user === '성호' ? setMCommentS(e.target.value) : setMCommentY(e.target.value)}
                  className={`mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ${user === '성호' ? 'focus:border-emerald-400' : 'focus:border-sky-400'}`} />
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {TENNIS_EMOJIS.map((em) => (
                    <button key={em} type="button" onClick={() => {
                      const add = (prev: string) => prev + em
                      if (user === '성호') setMCommentS(add); else setMCommentY(add)
                    }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-base active:bg-slate-100">{em}</button>
                  ))}
                </div>
              </div>
              <button onClick={saveMatchResult}
                className="w-full rounded-xl bg-sky-500 py-3 text-sm font-bold text-white shadow-sm active:bg-sky-600">
                {mEditId ? '결과 수정' : '결과 등록'}
              </button>
            </div>
          )}
        </section>
        )}
      </div>
    </main>
  )
}
