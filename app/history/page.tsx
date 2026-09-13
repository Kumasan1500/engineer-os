'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

type Skill = { id: number; name: string; slug: string }
type Unit = { id: number; title: string; slug: string; skill_id: number; estimated_minutes: number }
type Progress = {
  unit_id: number
  last_score: number
  retention_score: number
  attempts: number
  last_studied_at: string | null
}
type Session = {
  id: number
  unit_id: number | null
  started_at: string
  ended_at: string | null
  active_seconds: number
  lesson_seconds: number
  quiz_seconds: number
  review_seconds: number
  source: string
  device_type: string
}

function duration(seconds: number) {
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}分`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return `${hours}時間${rest ? `${rest}分` : ''}`
}

function dateKey(value: string | Date) {
  const d = typeof value === 'string' ? new Date(value) : value
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function startOfWeek() {
  const d = new Date()
  const day = d.getDay() || 7
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - day + 1)
  return d
}

async function fetchAllSessions(userId: string) {
  const all: Session[] = []
  const pageSize = 750
  for (let from = 0; from < 7500; from += pageSize) {
    const { data, error } = await supabase
      .from('study_sessions')
      .select('id,unit_id,started_at,ended_at,active_seconds,lesson_seconds,quiz_seconds,review_seconds,source,device_type')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .range(from, from + pageSize - 1)
    if (error) throw error
    const rows = (data ?? []) as Session[]
    all.push(...rows)
    if (rows.length < pageSize) break
  }
  return all
}

export default function HistoryPage() {
  const [user, setUser] = useState<User | null>(null)
  const [skills, setSkills] = useState<Skill[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [progress, setProgress] = useState<Progress[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser()
        setUser(userData.user ?? null)
        if (!userData.user) return
        const [{ data: skillData }, { data: unitData }, { data: progressData }, sessionData] = await Promise.all([
          supabase.from('skills').select('id,name,slug').order('sort_order'),
          supabase.from('learning_units').select('id,title,slug,skill_id,estimated_minutes').order('skill_id').order('sort_order'),
          supabase.from('user_progress').select('unit_id,last_score,retention_score,attempts,last_studied_at').eq('user_id', userData.user.id),
          fetchAllSessions(userData.user.id),
        ])
        setSkills((skillData ?? []) as Skill[])
        setUnits((unitData ?? []) as Unit[])
        setProgress((progressData ?? []) as Progress[])
        setSessions(sessionData)
      } catch (e) {
        setError(e instanceof Error ? e.message : '学習分析の取得に失敗しました')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const unitMap = useMemo(() => new Map(units.map(unit => [unit.id, unit])), [units])
  const skillMap = useMemo(() => new Map(skills.map(skill => [skill.id, skill])), [skills])
  const progressMap = useMemo(() => new Map(progress.map(p => [p.unit_id, p])), [progress])

  const now = new Date()
  const today = dateKey(now)
  const weekStart = startOfWeek().getTime()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  const totalSeconds = sessions.reduce((sum, s) => sum + s.active_seconds, 0)
  const todaySeconds = sessions.filter(s => dateKey(s.started_at) === today).reduce((sum, s) => sum + s.active_seconds, 0)
  const weekSeconds = sessions.filter(s => new Date(s.started_at).getTime() >= weekStart).reduce((sum, s) => sum + s.active_seconds, 0)
  const monthSeconds = sessions.filter(s => new Date(s.started_at).getTime() >= monthStart).reduce((sum, s) => sum + s.active_seconds, 0)
  const activeDays = new Set(sessions.filter(s => s.active_seconds > 0).map(s => dateKey(s.started_at))).size
  const averageSession = sessions.length ? Math.round(totalSeconds / sessions.length) : 0

  const byUnit = useMemo(() => {
    const map = new Map<number, { seconds: number; lesson: number; quiz: number; review: number; sessions: number }>()
    sessions.forEach(s => {
      if (!s.unit_id) return
      const v = map.get(s.unit_id) ?? { seconds: 0, lesson: 0, quiz: 0, review: 0, sessions: 0 }
      v.seconds += s.active_seconds
      v.lesson += s.lesson_seconds ?? 0
      v.quiz += s.quiz_seconds ?? 0
      v.review += s.review_seconds ?? 0
      v.sessions += 1
      map.set(s.unit_id, v)
    })
    return map
  }, [sessions])

  const bySkill = useMemo(() => {
    const map = new Map<number, number>()
    byUnit.forEach((value, unitId) => {
      const skillId = unitMap.get(unitId)?.skill_id
      if (skillId) map.set(skillId, (map.get(skillId) ?? 0) + value.seconds)
    })
    return [...map.entries()].map(([skillId, seconds]) => ({ skillId, seconds })).sort((a, b) => b.seconds - a.seconds)
  }, [byUnit, unitMap])

  const phase = useMemo(() => {
    const lesson = sessions.reduce((sum, s) => sum + (s.lesson_seconds ?? 0), 0)
    const quiz = sessions.reduce((sum, s) => sum + (s.quiz_seconds ?? 0), 0)
    const review = sessions.reduce((sum, s) => sum + (s.review_seconds ?? 0), 0)
    const detailed = lesson + quiz + review
    return { lesson, quiz, review, legacy: Math.max(0, totalSeconds - detailed) }
  }, [sessions, totalSeconds])

  const daily = useMemo(() => {
    const points: { key: string; label: string; seconds: number }[] = []
    for (let i = 13; i >= 0; i -= 1) {
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      d.setDate(d.getDate() - i)
      const key = dateKey(d)
      points.push({ key, label: `${d.getMonth() + 1}/${d.getDate()}`, seconds: sessions.filter(s => dateKey(s.started_at) === key).reduce((sum, s) => sum + s.active_seconds, 0) })
    }
    return points
  }, [sessions])
  const maxDaily = Math.max(...daily.map(d => d.seconds), 1)

  const unitCards = units
    .map(unit => ({ unit, time: byUnit.get(unit.id), progress: progressMap.get(unit.id) }))
    .filter(item => item.time || item.progress)
    .sort((a, b) => (b.time?.seconds ?? 0) - (a.time?.seconds ?? 0))

  if (loading) return <main className="pageShell narrow"><p>Learning Analyticsを読み込み中...</p></main>
  if (!user) return <main className="pageShell narrow"><p>学習分析を見るにはログインしてください。</p><Link className="primaryLink" href="/login">ログイン</Link></main>
  if (error) return <main className="pageShell narrow"><h1>Learning Analytics</h1><p>{error}</p><small>v1.1のSQL migrationを実行したか確認してください。</small></main>

  return (
    <main className="pageShell analyticsShell">
      <div className="breadcrumb"><Link href="/">Engineer OS</Link> / Progress</div>
      <div className="sectionTitle"><div><span className="eyebrow">V1.1 LEARNING ANALYTICS</span><h1>学習分析</h1></div><span>{activeDays} study days</span></div>

      <section className="analyticsMetricGrid">
        <div className="panel analyticsMetric hero"><span>ALL TIME</span><b>{duration(totalSeconds)}</b><small>累計実学習時間</small></div>
        <div className="panel analyticsMetric"><span>TODAY</span><b>{duration(todaySeconds)}</b><small>今日</small></div>
        <div className="panel analyticsMetric"><span>THIS WEEK</span><b>{duration(weekSeconds)}</b><small>今週</small></div>
        <div className="panel analyticsMetric"><span>THIS MONTH</span><b>{duration(monthSeconds)}</b><small>今月</small></div>
      </section>

      <section className="panel analyticsSection">
        <div className="analyticsSectionHead"><div><span className="eyebrow">CONSISTENCY</span><h2>直近14日</h2></div><small>平均セッション {duration(averageSession)}</small></div>
        <div className="dayBars">
          {daily.map(day => <div className="dayBar" key={day.key}><div className="dayBarTrack"><i style={{ height: `${Math.max(4, day.seconds / maxDaily * 100)}%` }} /></div><b>{day.seconds ? Math.round(day.seconds / 60) : 0}</b><span>{day.label}</span></div>)}
        </div>
      </section>

      <div className="analyticsTwoCol">
        <section className="panel analyticsSection">
          <div className="analyticsSectionHead"><div><span className="eyebrow">DOMAINS</span><h2>分野別投資時間</h2></div></div>
          <div className="analyticsRankList">
            {bySkill.length ? bySkill.map(({ skillId, seconds }) => {
              const skill = skillMap.get(skillId)
              const pct = totalSeconds ? Math.round(seconds / totalSeconds * 100) : 0
              return <div key={skillId}><div><b>{skill?.name ?? 'Unknown'}</b><span>{duration(seconds)} ・ {pct}%</span></div><div className="thinProgress"><i style={{ width: `${pct}%` }} /></div></div>
            }) : <p className="mutedText">学習時間が蓄積されると表示されます。</p>}
          </div>
        </section>

        <section className="panel analyticsSection">
          <div className="analyticsSectionHead"><div><span className="eyebrow">MODE</span><h2>学習形式</h2></div></div>
          <div className="phaseList">
            {[['講義', phase.lesson], ['問題演習', phase.quiz], ['解説・復習', phase.review], ['旧バージョン記録', phase.legacy]].map(([label, value]) => {
              const sec = Number(value)
              const pct = totalSeconds ? Math.round(sec / totalSeconds * 100) : 0
              return <div key={String(label)}><span>{label}</span><b>{duration(sec)}</b><small>{pct}%</small></div>
            })}
          </div>
        </section>
      </div>

      <section className="learningSection">
        <div className="analyticsSectionHead"><div><span className="eyebrow">UNIT CARDS</span><h2>単元カルテ</h2></div><small>時間 × 正答 × Mastery</small></div>
        <div className="unitAnalyticsGrid">
          {unitCards.map(({ unit, time, progress: p }) => {
            const mastery = p?.retention_score ?? 0
            const hours = (time?.seconds ?? 0) / 3600
            const efficiency = hours > 0 ? Math.round(mastery / hours) : 0
            return <Link className="panel unitAnalyticsCard" href={`/learn/${unit.slug}`} key={unit.id}>
              <div className="unitAnalyticsTop"><div><b>{unit.title}</b><span>{skillMap.get(unit.skill_id)?.name}</span></div><strong>{duration(time?.seconds ?? 0)}</strong></div>
              <div className="unitAnalyticsStats"><div><span>Mastery</span><b>{mastery}%</b></div><div><span>Attempts</span><b>{p?.attempts ?? 0}</b></div><div><span>Last</span><b>{p?.last_score ?? 0}点</b></div></div>
              <div className="thinProgress masteryBar"><i style={{ width: `${mastery}%` }} /></div>
              <small>講義 {duration(time?.lesson ?? 0)} / 問題 {duration(time?.quiz ?? 0)} / 復習 {duration(time?.review ?? 0)}{efficiency ? ` ・ ${efficiency} Mastery/h` : ''}</small>
            </Link>
          })}
        </div>
      </section>

      <section className="learningSection">
        <div className="analyticsSectionHead"><div><span className="eyebrow">RECENT</span><h2>最近のセッション</h2></div></div>
        <div className="historyList">
          {sessions.slice(0, 30).map(session => {
            const unit = session.unit_id ? unitMap.get(session.unit_id) : null
            return <div className="panel historyRow" key={session.id}><div><b>{unit?.title ?? '学習セッション'}</b><small>{new Intl.DateTimeFormat('ja-JP', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' }).format(new Date(session.started_at))} ・ {session.device_type}</small></div><div className="historyScores"><span>{duration(session.active_seconds)}</span></div></div>
          })}
        </div>
      </section>
    </main>
  )
}
