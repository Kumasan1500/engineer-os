'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

type Unit = { id: number; title: string; slug: string }
type Progress = {
  unit_id: number
  last_score: number
  mastery_score: number
  retention_score: number
  attempts: number
  last_studied_at: string | null
  status: string
}
type Session = {
  id: number
  unit_id: number | null
  started_at: string
  active_seconds: number
  source: string
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}秒`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}分`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return `${hours}時間${rest ? `${rest}分` : ''}`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

export default function HistoryPage() {
  const [user, setUser] = useState<User | null>(null)
  const [units, setUnits] = useState<Unit[]>([])
  const [progress, setProgress] = useState<Progress[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: userData } = await supabase.auth.getUser()
      setUser(userData.user ?? null)
      if (!userData.user) {
        setLoading(false)
        return
      }
      const [{ data: unitData }, { data: progressData }, { data: sessionData }] = await Promise.all([
        supabase.from('learning_units').select('id,title,slug'),
        supabase
          .from('user_progress')
          .select('unit_id,last_score,mastery_score,retention_score,attempts,last_studied_at,status')
          .eq('user_id', userData.user.id)
          .order('last_studied_at', { ascending: false }),
        supabase
          .from('study_sessions')
          .select('id,unit_id,started_at,active_seconds,source')
          .eq('user_id', userData.user.id)
          .order('started_at', { ascending: false })
          .limit(50),
      ])
      setUnits((unitData ?? []) as Unit[])
      setProgress((progressData ?? []) as Progress[])
      setSessions((sessionData ?? []) as Session[])
      setLoading(false)
    }
    load()
  }, [])

  const unitMap = useMemo(() => new Map(units.map(unit => [unit.id, unit])), [units])
  const totalSeconds = sessions.reduce((sum, session) => sum + session.active_seconds, 0)
  const totalAttempts = progress.reduce((sum, item) => sum + item.attempts, 0)
  const avgMastery = progress.length ? Math.round(progress.reduce((sum, item) => sum + item.retention_score, 0) / progress.length) : 0

  if (loading) return <main className="pageShell narrow"><p>履歴を読み込み中...</p></main>
  if (!user) return <main className="pageShell narrow"><p>学習履歴を見るにはログインしてください。</p><Link className="primaryLink" href="/login">ログイン</Link></main>

  return (
    <main className="pageShell narrow">
      <div className="breadcrumb"><Link href="/">Engineer OS</Link> / History</div>
      <div className="sectionTitle"><h1>学習履歴</h1><span>v0.6 Learning OS</span></div>

      <section className="dailyStats historyStats">
        <div className="panel dailyStat"><span className="eyebrow">STUDY TIME</span><b>{formatDuration(totalSeconds)}</b><small>直近50セッション</small></div>
        <div className="panel dailyStat"><span className="eyebrow">ATTEMPTS</span><b>{totalAttempts}</b><small>累計単元挑戦</small></div>
        <div className="panel dailyStat"><span className="eyebrow">AVG MASTERY</span><b>{avgMastery}%</b><small>学習済み単元</small></div>
      </section>

      <section className="learningSection">
        <h2>単元ごとの到達状況</h2>
        <div className="historyList">
          {progress.map(item => {
            const unit = unitMap.get(item.unit_id)
            if (!unit) return null
            return (
              <Link href={`/learn/${unit.slug}`} className="panel historyRow" key={item.unit_id}>
                <div>
                  <b>{unit.title}</b>
                  <small>{item.last_studied_at ? formatDate(item.last_studied_at) : '未記録'} ・ {item.attempts}回</small>
                </div>
                <div className="historyScores"><span>{item.last_score}点</span><small>Mastery {item.retention_score}%</small></div>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="learningSection">
        <h2>最近の学習セッション</h2>
        <div className="historyList">
          {sessions.map(session => {
            const unit = session.unit_id ? unitMap.get(session.unit_id) : null
            return (
              <div className="panel historyRow" key={session.id}>
                <div><b>{unit?.title ?? '学習セッション'}</b><small>{formatDate(session.started_at)} ・ {session.source}</small></div>
                <div className="historyScores"><span>{formatDuration(session.active_seconds)}</span></div>
              </div>
            )
          })}
        </div>
      </section>
    </main>
  )
}
