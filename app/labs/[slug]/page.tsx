'use client'
import PassiveStudyTracker from '@/app/components/PassiveStudyTracker'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

type Lab = {
  id: number
  slug: string
  title: string
  description: string | null
  instructions: string[]
  success_criteria: string[]
  estimated_minutes: number
}

type Attempt = { status: string; notes: string | null; started_at: string | null; completed_at: string | null }

export default function LabDetailPage() {
  const params = useParams()
  const slug = params.slug as string
  const [user, setUser] = useState<User | null>(null)
  const [lab, setLab] = useState<Lab | null>(null)
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [notes, setNotes] = useState('')
  const [checks, setChecks] = useState<boolean[]>([])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const [{ data: userData }, { data: labData }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('hands_on_labs').select('*').eq('slug', slug).single<Lab>(),
      ])
      setUser(userData.user ?? null)
      setLab(labData ?? null)
      setChecks(new Array(labData?.instructions?.length ?? 0).fill(false))
      if (userData.user && labData) {
        const { data } = await supabase.from('user_lab_attempts').select('status,notes,started_at,completed_at').eq('user_id', userData.user.id).eq('lab_id', labData.id).maybeSingle<Attempt>()
        setAttempt(data ?? null)
        setNotes(data?.notes ?? '')
        if (!data) {
          const now = new Date().toISOString()
          await supabase.from('user_lab_attempts').upsert({ user_id: userData.user.id, lab_id: labData.id, status: 'in_progress', started_at: now, updated_at: now }, { onConflict: 'user_id,lab_id' })
          setAttempt({ status: 'in_progress', notes: null, started_at: now, completed_at: null })
        }
      }
      setLoading(false)
    }
    load()
  }, [slug])

  const save = async (complete = false) => {
    if (!user || !lab) return
    setSaving(true)
    const now = new Date().toISOString()
    const status = complete ? 'completed' : 'in_progress'
    const { error } = await supabase.from('user_lab_attempts').upsert({
      user_id: user.id,
      lab_id: lab.id,
      status,
      notes,
      started_at: attempt?.started_at ?? now,
      completed_at: complete ? now : attempt?.completed_at ?? null,
      updated_at: now,
    }, { onConflict: 'user_id,lab_id' })
    setSaving(false)
    if (error) setMessage(error.message)
    else {
      setAttempt({ status, notes, started_at: attempt?.started_at ?? now, completed_at: complete ? now : attempt?.completed_at ?? null })
      setMessage(complete ? 'Labを完了として保存しました。' : 'メモを保存しました。')
    }
  }

  if (loading) return <main className="pageShell narrow"><p>Labを読み込み中...</p></main>
  if (!lab) return <main className="pageShell narrow"><p>Labが見つかりません。</p></main>
  if (!user) return <main className="pageShell narrow"><p>Labを記録するにはログインしてください。</p><Link className="primaryLink" href="/login">ログイン</Link></main>

  const allChecked = checks.length > 0 && checks.every(Boolean)
  const canComplete = allChecked && notes.trim().length >= 20

  return (
    <main className="pageShell narrow">
      <PassiveStudyTracker source="lab" />
      <div className="breadcrumb"><Link href="/">Engineer OS</Link> / <Link href="/labs">Labs</Link> / {lab.title}</div>
      <span className="eyebrow">HANDS-ON · 約{lab.estimated_minutes}分</span>
      <h1>{lab.title}</h1>
      <p className="leadText">{lab.description}</p>

      <section className="learningSection">
        <h2>手順</h2>
        <div className="labChecklist">
          {(lab.instructions ?? []).map((instruction, index) => (
            <label className="panel checklistRow" key={index}>
              <input type="checkbox" checked={checks[index] ?? false} onChange={event => setChecks(prev => prev.map((v, i) => i === index ? event.target.checked : v))} />
              <span><b>{index + 1}</b>{instruction}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="learningSection">
        <h2>合格基準</h2>
        <ul>{(lab.success_criteria ?? []).map((criterion, index) => <li key={index}>{criterion}</li>)}</ul>
      </section>

      <section className="learningSection">
        <h2>観察メモ</h2>
        <textarea className="labNotes" value={notes} onChange={event => setNotes(event.target.value)} placeholder="何を操作し、何が変化し、なぜそうなったと考えるかを書いてください（20文字以上）。" />
        <div className="resultActions">
          <button className="secondaryButton" disabled={saving} onClick={() => save(false)}>途中保存</button>
          <button className="primaryButton" disabled={!canComplete || saving} onClick={() => save(true)}>Lab完了</button>
        </div>
        {!canComplete && <p className="mutedText">全手順を確認し、観察メモを20文字以上書くと完了できます。</p>}
        {message && <p className="statusMessage">{message}</p>}
      </section>
    </main>
  )
}