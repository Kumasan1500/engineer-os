'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

type Track = {
  id: number
  slug: string
  name: string
  provider: string | null
  description: string | null
  mastery_target: number
  mock_pass_score: number
  required_mock_passes: number
  required_labs: number
}

type Unit = { id: number; skill_id: number }
type Skill = { id: number; slug: string }
type Progress = { unit_id: number; status: string; retention_score: number }
type Lab = { id: number; track_id: number | null }
type LabAttempt = { lab_id: number; status: string }
type MockExam = { id: number; track_id: number | null; pass_score: number }
type MockAttempt = { mock_exam_id: number; score: number; completed_at: string }

type Gate = {
  track: Track
  curriculum: number
  mastery: number
  labs: number
  labsDone: number
  mockStable: boolean
  recentMocks: MockAttempt[]
  ready: boolean
}

export default function ReadinessPage() {
  const [user, setUser] = useState<User | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [progress, setProgress] = useState<Progress[]>([])
  const [labs, setLabs] = useState<Lab[]>([])
  const [labAttempts, setLabAttempts] = useState<LabAttempt[]>([])
  const [mockExams, setMockExams] = useState<MockExam[]>([])
  const [mockAttempts, setMockAttempts] = useState<MockAttempt[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: userData } = await supabase.auth.getUser()
      setUser(userData.user ?? null)

      const [trackRes, skillRes, unitRes, labRes, mockRes] = await Promise.all([
        supabase.from('certification_tracks').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('skills').select('id,slug'),
        supabase.from('learning_units').select('id,skill_id'),
        supabase.from('hands_on_labs').select('id,track_id').eq('is_active', true),
        supabase.from('mock_exams').select('id,track_id,pass_score').eq('is_active', true),
      ])

      setTracks((trackRes.data ?? []) as Track[])
      setSkills((skillRes.data ?? []) as Skill[])
      setUnits((unitRes.data ?? []) as Unit[])
      setLabs((labRes.data ?? []) as Lab[])
      setMockExams((mockRes.data ?? []) as MockExam[])

      if (userData.user) {
        const [progressRes, labsAttemptRes, mockAttemptRes] = await Promise.all([
          supabase.from('user_progress').select('unit_id,status,retention_score').eq('user_id', userData.user.id),
          supabase.from('user_lab_attempts').select('lab_id,status').eq('user_id', userData.user.id),
          supabase.from('mock_exam_attempts').select('mock_exam_id,score,completed_at').eq('user_id', userData.user.id).order('completed_at', { ascending: false }),
        ])
        setProgress((progressRes.data ?? []) as Progress[])
        setLabAttempts((labsAttemptRes.data ?? []) as LabAttempt[])
        setMockAttempts((mockAttemptRes.data ?? []) as MockAttempt[])
      }
      setLoading(false)
    }
    load()
  }, [])

  const gates = useMemo<Gate[]>(() => {
    const foundationSkillId = skills.find(skill => skill.slug === 'computer-fundamentals')?.id
    const progressMap = new Map(progress.map(item => [item.unit_id, item]))
    const labStatusMap = new Map(labAttempts.map(item => [item.lab_id, item.status]))

    return tracks.map(track => {
      const trackUnits = track.slug === 'foundation-gate' && foundationSkillId
        ? units.filter(unit => unit.skill_id === foundationSkillId)
        : []
      const completed = trackUnits.filter(unit => progressMap.get(unit.id)?.status === 'completed').length
      const curriculum = trackUnits.length ? Math.round((completed / trackUnits.length) * 100) : 0
      const mastery = trackUnits.length
        ? Math.round(trackUnits.reduce((sum, unit) => sum + (progressMap.get(unit.id)?.retention_score ?? 0), 0) / trackUnits.length)
        : 0

      const trackLabs = labs.filter(lab => lab.track_id === track.id)
      const labsDone = trackLabs.filter(lab => labStatusMap.get(lab.id) === 'completed').length
      const labPct = trackLabs.length ? Math.round((labsDone / trackLabs.length) * 100) : 0

      const examIds = mockExams.filter(exam => exam.track_id === track.id).map(exam => exam.id)
      const recentMocks = mockAttempts.filter(attempt => examIds.includes(attempt.mock_exam_id)).slice(0, Math.max(track.required_mock_passes, 3))
      const mockStable = track.required_mock_passes === 0 || (
        recentMocks.length >= track.required_mock_passes &&
        recentMocks.slice(0, track.required_mock_passes).every(attempt => attempt.score >= track.mock_pass_score)
      )

      const supported = track.slug === 'foundation-gate'
      const ready = supported && curriculum === 100 && mastery >= track.mastery_target && labPct === 100 && mockStable
      return { track, curriculum, mastery, labs: labPct, labsDone, mockStable, recentMocks, ready }
    })
  }, [tracks, skills, units, progress, labs, labAttempts, mockExams, mockAttempts])

  if (loading) return <main className="pageShell"><p>Readinessを計算中...</p></main>
  if (!user) return <main className="pageShell narrow"><div className="breadcrumb"><Link href="/">Engineer OS</Link> / Readiness</div><h1>資格・実践 Readiness</h1><p className="mutedText">判定を保存するにはログインしてください。</p><Link className="primaryLink" href="/login">ログイン</Link></main>

  return (
    <main className="pageShell">
      <div className="breadcrumb"><Link href="/">Engineer OS</Link> / Readiness</div>
      <div className="sectionTitle"><h1>資格・実践 Readiness</h1><span>v0.7</span></div>
      <p className="leadText">1回の高得点ではREADYにしません。学習完了・時間を空けた定着・Hands-on・複数回の模試をすべて通過して初めてREADYになります。</p>

      <div className="readinessList">
        {gates.map(gate => {
          const supported = gate.track.slug === 'foundation-gate'
          return (
            <section className="panel readinessTrack" key={gate.track.id}>
              <div className="readinessTrackHeader">
                <div><span className="eyebrow">{gate.track.provider ?? 'Engineer OS'}</span><h2>{gate.track.name}</h2><p>{gate.track.description}</p></div>
                <span className={gate.ready ? 'readyPill ready' : 'readyPill'}>{gate.ready ? 'READY' : supported ? 'TRAINING' : 'LOCKED'}</span>
              </div>

              <div className="gateGrid">
                <GateMetric label="CURRICULUM" value={gate.curriculum} target={100} suffix="%" />
                <GateMetric label="MASTERY" value={gate.mastery} target={gate.track.mastery_target} suffix="%" />
                <GateMetric label="HANDS-ON" value={gate.labs} target={100} suffix="%" sub={`${gate.labsDone}/${gate.track.required_labs || 0} labs`} />
                <GateMetric label="MOCK STABILITY" value={gate.mockStable ? 100 : 0} target={100} suffix="%" sub={`${gate.track.required_mock_passes}回連続 ${gate.track.mock_pass_score}%+`} />
              </div>

              {supported ? (
                <div className="readinessActions">
                  <Link className="secondaryButton linkButton" href="/labs">Hands-on Labs</Link>
                  <Link className="primaryLink" href="/mock/foundation">Foundation 模擬試験</Link>
                </div>
              ) : (
                <p className="statusMessage">この資格はロードマップ上の次段階です。対応教材・Labs・資格別模試を追加すると本判定が有効になります。</p>
              )}

              {gate.recentMocks.length > 0 && supported && (
                <div className="recentMockLine"><span>Recent mocks</span>{gate.recentMocks.slice(0, 3).map((attempt, i) => <b key={`${attempt.completed_at}-${i}`}>{attempt.score}%</b>)}</div>
              )}
            </section>
          )
        })}
      </div>
    </main>
  )
}

function GateMetric({ label, value, target, suffix, sub }: { label: string; value: number; target: number; suffix: string; sub?: string }) {
  const pass = value >= target
  return (
    <div className="gateMetric">
      <span className="eyebrow">{label}</span>
      <b>{value}{suffix}</b>
      <small>{sub ?? `target ${target}${suffix}`}</small>
      <div className="thinProgress"><div style={{ width: `${Math.min(value, 100)}%` }} /></div>
      <em className={pass ? 'gatePass' : ''}>{pass ? 'PASS' : 'NOT YET'}</em>
    </div>
  )
}
