'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import AuthStatus from '@/app/components/AuthStatus'
import { supabase } from '@/lib/supabase'

type Skill = {
  id: number
  slug: string
  name: string
  category: string
  description: string | null
  sort_order: number
}

type LearningUnit = {
  id: number
  skill_id: number
  slug: string
  title: string
  description: string | null
  difficulty: number
  estimated_minutes: number
  sort_order: number
}

type Progress = {
  unit_id: number
  status: 'not_started' | 'learning' | 'review' | 'completed'
  mastery_score: number
  retention_score: number
  last_score: number
  attempts: number
  review_due_at: string | null
}

type StudySession = {
  started_at: string
  active_seconds: number
}

type Mission = {
  unit: LearningUnit
  kind: 'review' | 'learn'
  note: string
  minutes: number
}

function localDateKey(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function calculateStreak(sessions: StudySession[]) {
  if (!sessions.length) return 0
  const days = new Set(sessions.filter(session => session.active_seconds > 0).map(session => localDateKey(session.started_at)))
  const cursor = new Date()
  if (!days.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while (days.has(localDateKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export default function Home() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [units, setUnits] = useState<LearningUnit[]>([])
  const [progress, setProgress] = useState<Progress[]>([])
  const [sessions, setSessions] = useState<StudySession[]>([])
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        const [{ data: skillData, error: skillError }, { data: unitData, error: unitError }, { data: userData }] = await Promise.all([
          supabase.from('skills').select('*').order('sort_order'),
          supabase.from('learning_units').select('*').order('skill_id').order('sort_order'),
          supabase.auth.getUser(),
        ])

        if (skillError) throw skillError
        if (unitError) throw unitError
        setSkills(skillData ?? [])
        setUnits(unitData ?? [])
        setUser(userData.user ?? null)

        if (userData.user) {
          await supabase.from('profiles').upsert({
            id: userData.user.id,
            display_name: userData.user.email?.split('@')[0] ?? 'Engineer',
            target_salary: 10000000,
            target_years: 4,
            updated_at: new Date().toISOString(),
          })
          const since = new Date()
          since.setDate(since.getDate() - 45)
          const [{ data: progressData, error: progressError }, { data: sessionData }] = await Promise.all([
            supabase
              .from('user_progress')
              .select('unit_id,status,mastery_score,retention_score,last_score,attempts,review_due_at')
              .eq('user_id', userData.user.id),
            supabase
              .from('study_sessions')
              .select('started_at,active_seconds')
              .eq('user_id', userData.user.id)
              .gte('started_at', since.toISOString())
              .order('started_at', { ascending: false }),
          ])
          if (progressError) throw progressError
          setProgress((progressData ?? []) as Progress[])
          setSessions((sessionData ?? []) as StudySession[])
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'データ取得に失敗しました')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const progressMap = useMemo(() => new Map(progress.map(item => [item.unit_id, item])), [progress])

  const totalProgress = useMemo(() => {
    if (!units.length) return 0
    const completed = units.filter(unit => progressMap.get(unit.id)?.status === 'completed').length
    return Math.round((completed / units.length) * 100)
  }, [units, progressMap])

  const totalMastery = useMemo(() => {
    if (!units.length) return 0
    const sum = units.reduce((acc, unit) => acc + (progressMap.get(unit.id)?.retention_score ?? 0), 0)
    return Math.round(sum / units.length)
  }, [units, progressMap])

  const foundationReadiness = useMemo(() => {
    const foundationSkill = skills.find(skill => skill.slug === 'computer-fundamentals')
    if (!foundationSkill) return 0
    const foundationUnits = units.filter(unit => unit.skill_id === foundationSkill.id)
    if (!foundationUnits.length) return 0
    const completed = foundationUnits.filter(unit => progressMap.get(unit.id)?.status === 'completed').length
    const progressPct = Math.round((completed / foundationUnits.length) * 100)
    const masteryPct = Math.round(foundationUnits.reduce((sum, unit) => sum + (progressMap.get(unit.id)?.retention_score ?? 0), 0) / foundationUnits.length)
    return Math.min(progressPct, masteryPct)
  }, [skills, units, progressMap])

  const todayStudySeconds = useMemo(() => {
    const today = localDateKey(new Date())
    return sessions.filter(session => localDateKey(session.started_at) === today).reduce((sum, session) => sum + session.active_seconds, 0)
  }, [sessions])

  const streak = useMemo(() => calculateStreak(sessions), [sessions])
  const dueReviewCount = useMemo(() => progress.filter(item => item.review_due_at && new Date(item.review_due_at).getTime() <= Date.now()).length, [progress])

  const isUnlocked = (unit: LearningUnit, unitIndex: number, skillUnits: LearningUnit[]) => {
    if (unitIndex === 0) return true
    if (!user) return false
    const previous = skillUnits[unitIndex - 1]
    return progressMap.get(previous.id)?.status === 'completed'
  }

  const missions = useMemo<Mission[]>(() => {
    if (!user) return []
    const now = Date.now()
    const due: Mission[] = units
      .filter(unit => {
        const p = progressMap.get(unit.id)
        return p?.review_due_at && new Date(p.review_due_at).getTime() <= now
      })
      .sort((a, b) => (progressMap.get(a.id)?.retention_score ?? 0) - (progressMap.get(b.id)?.retention_score ?? 0))
      .slice(0, 2)
      .map(unit => ({
        unit,
        kind: 'review' as const,
        note: `定着度 ${progressMap.get(unit.id)?.retention_score ?? 0}% — 忘却前に回収`,
        minutes: Math.max(8, Math.round(unit.estimated_minutes * 0.45)),
      }))

    const nextLearning: Mission[] = []
    for (const skill of skills) {
      const skillUnits = units.filter(unit => unit.skill_id === skill.id)
      for (let i = 0; i < skillUnits.length; i += 1) {
        const unit = skillUnits[i]
        if (progressMap.get(unit.id)?.status === 'completed') continue
        if (isUnlocked(unit, i, skillUnits)) {
          nextLearning.push({ unit, kind: 'learn', note: '次に進める新規学習', minutes: unit.estimated_minutes })
          break
        }
      }
      if (nextLearning.length) break
    }

    return [...due, ...nextLearning].slice(0, 3)
  }, [user, units, skills, progressMap])

  const missionMinutes = missions.reduce((sum, mission) => sum + mission.minutes, 0)

  if (loading) return <main className="pageShell"><p>Engineer OSを読み込み中...</p></main>
  if (error) return <main className="pageShell"><h1>Engineer OS</h1><p>Supabase接続エラー</p><pre>{error}</pre></main>

  return (
    <main className="pageShell">
      <header className="dashboardHeader">
        <div>
          <div className="eyebrow">1000万円 ENGINEER ROADMAP</div>
          <h1>Engineer OS</h1>
          <p className="mutedText">年収1000万円超エンジニアへのロードマップ</p>
        </div>
        <div className="headerActions">
          {user && <Link className="ghostButton" href="/career">Career OS</Link>}
          {user && <Link className="ghostButton" href="/tech-radar">Tech Radar</Link>}
          {user && <Link className="ghostButton" href="/readiness">資格・実践</Link>}
          {user && <Link className="ghostButton" href="/history">学習履歴</Link>}
          {user && <Link className="ghostButton" href="/settings">設定</Link>}
          <AuthStatus />
        </div>
      </header>
      <section className="mobileSnapshot" aria-label="今日のサマリー">
        <div><span>Progress</span><b>{totalProgress}%</b></div>
        <div><span>Mastery</span><b>{totalMastery}%</b></div>
        <div><span>Today</span><b>{Math.round(todayStudySeconds / 60)}m</b></div>
      </section>

      <section className="metricGrid metricGridThree">
        <div className="panel metricCard">
          <span className="eyebrow">TOTAL PROGRESS</span>
          <strong>{totalProgress}%</strong>
          <p>学習カリキュラムの完了率</p>
          <div className="thinProgress"><div style={{ width: `${totalProgress}%` }} /></div>
        </div>
        <div className="panel metricCard">
          <span className="eyebrow">TOTAL MASTERY</span>
          <strong>{totalMastery}%</strong>
          <p>時間を空けても再現できる知識</p>
          <div className="thinProgress masteryBar"><div style={{ width: `${totalMastery}%` }} /></div>
        </div>
        <div className="panel metricCard readinessCard">
          <span className="eyebrow">FOUNDATION READINESS</span>
          <strong>{foundationReadiness}%</strong>
          <p>完了率と定着度の弱い方を基準に判定</p>
          <div className="thinProgress readinessBar"><div style={{ width: `${foundationReadiness}%` }} /></div>
          <small className={foundationReadiness >= 80 ? 'readyText' : 'gateText'}>
            {foundationReadiness >= 80 ? 'READY — 基礎ゲート到達' : 'TARGET — 80%以上を安定維持'}
          </small>
        </div>
      </section>

      {user && (
        <section className="dailyStats">
          <div className="panel dailyStat"><span className="eyebrow">TODAY</span><b>{Math.round(todayStudySeconds / 60)}分</b><small>実学習時間</small></div>
          <div className="panel dailyStat"><span className="eyebrow">STREAK</span><b>{streak}日</b><small>連続学習</small></div>
          <div className="panel dailyStat"><span className="eyebrow">REVIEW DUE</span><b>{dueReviewCount}</b><small>復習待ち単元</small></div>
        </section>
      )}

      <section className="panel missionPanel">
        <div className="sectionTitle compact">
          <h2>今日のミッション</h2>
          <span>{user ? `${missions.length} tasks / 約${missionMinutes}分` : 'login required'}</span>
        </div>
        {!user ? (
          <p className="mutedText">ログインすると、復習期限・Mastery・進行状況から今日やる内容を自動編成します。</p>
        ) : missions.length === 0 ? (
          <p className="mutedText">今日の復習はありません。次の単元を進めましょう。</p>
        ) : (
          <div className="missionList">
            {missions.map(({ unit, kind, note, minutes }) => (
              <Link href={`/learn/${unit.slug}`} className="missionRow" key={`${kind}-${unit.id}`}>
                <span className={`missionTag ${kind}`}>{kind === 'review' ? 'REVIEW' : 'LEARN'}</span>
                <div><b>{unit.title}</b><small>{note} ・ 約{minutes}分</small></div>
                <span>→</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section id="learning-path">
        <div className="sectionTitle"><h2>現在の重点分野</h2><span>{skills.length} domains</span></div>
        <div className="domainList">
          {skills.map(skill => {
            const skillUnits = units.filter(unit => unit.skill_id === skill.id)
            const completed = skillUnits.filter(unit => progressMap.get(unit.id)?.status === 'completed').length
            const pct = skillUnits.length ? Math.round((completed / skillUnits.length) * 100) : 0
            const mastery = skillUnits.length ? Math.round(skillUnits.reduce((sum, unit) => sum + (progressMap.get(unit.id)?.retention_score ?? 0), 0) / skillUnits.length) : 0

            return (
              <article className="panel domainCard" key={skill.id}>
                <div className="domainHeader">
                  <div><h3>{skill.name}</h3><span>{skill.category}</span></div>
                  <div className="domainScores"><strong>{pct}%</strong><small>Mastery {mastery}%</small></div>
                </div>
                <p>{skill.description}</p>
                {skillUnits.length > 0 && (
                  <div className="moduleProgress">
                    <div className="moduleProgressMeta"><span className="eyebrow">UNIT PROGRESS</span><b>{completed} / {skillUnits.length} units</b></div>
                    <div className="thinProgress"><div style={{ width: `${pct}%` }} /></div>
                    <div className="moduleProgressMeta masteryMeta"><span className="eyebrow">MASTERY</span><b>{mastery}%</b></div>
                    <div className="thinProgress masteryBar"><div style={{ width: `${mastery}%` }} /></div>
                  </div>
                )}
                {skillUnits.length > 0 && (
                  <div className="unitList">
                    {skillUnits.map((unit, index) => {
                      const p = progressMap.get(unit.id)
                      const unlocked = isUnlocked(unit, index, skillUnits)
                      const content = (
                        <>
                          <div><b>{unit.title}</b><small>{unit.estimated_minutes}分 / 難易度 {unit.difficulty}</small></div>
                          <span className="unitStatus">
                            {p?.status === 'completed' ? <><b>✓ {p.last_score || p.mastery_score}%</b><small>M {p.retention_score ?? 0}%</small></> : unlocked ? '→' : '🔒'}
                          </span>
                        </>
                      )
                      return unlocked ? <Link className="unitRow" href={`/learn/${unit.slug}`} key={unit.id}>{content}</Link> : <div className="unitRow locked" key={unit.id}>{content}</div>
                    })}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      </section>
    </main>
  )
}
