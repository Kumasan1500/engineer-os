'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

type Lab = { id: number; slug: string; title: string; description: string | null; estimated_minutes: number; sort_order: number }
type Attempt = { lab_id: number; status: string }

export default function LabsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [labs, setLabs] = useState<Lab[]>([])
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const [{ data: userData }, { data: track }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('certification_tracks').select('id').eq('slug', 'foundation-gate').single<{ id: number }>(),
      ])
      setUser(userData.user ?? null)
      if (track) {
        const { data: labData } = await supabase.from('hands_on_labs').select('id,slug,title,description,estimated_minutes,sort_order').eq('track_id', track.id).eq('is_active', true).order('sort_order')
        setLabs((labData ?? []) as Lab[])
      }
      if (userData.user) {
        const { data } = await supabase.from('user_lab_attempts').select('lab_id,status').eq('user_id', userData.user.id)
        setAttempts((data ?? []) as Attempt[])
      }
      setLoading(false)
    }
    load()
  }, [])

  const statusMap = useMemo(() => new Map(attempts.map(item => [item.lab_id, item.status])), [attempts])
  const completed = labs.filter(lab => statusMap.get(lab.id) === 'completed').length
  const pct = labs.length ? Math.round((completed / labs.length) * 100) : 0

  if (loading) return <main className="pageShell narrow"><p>Labsを読み込み中...</p></main>
  if (!user) return <main className="pageShell narrow"><div className="breadcrumb"><Link href="/">Engineer OS</Link> / Labs</div><h1>Hands-on Labs</h1><p className="mutedText">実機演習の記録にはログインしてください。</p><Link className="primaryLink" href="/login">ログイン</Link></main>

  return (
    <main className="pageShell narrow">
      <div className="breadcrumb"><Link href="/">Engineer OS</Link> / <Link href="/readiness">Readiness</Link> / Labs</div>
      <div className="sectionTitle"><h1>Foundation Hands-on Labs</h1><span>{completed}/{labs.length} completed</span></div>
      <div className="panel labProgress"><span className="eyebrow">PRACTICAL PROGRESS</span><b>{pct}%</b><div className="thinProgress"><div style={{ width: `${pct}%` }} /></div></div>
      <p className="leadText">知識だけでなく、自分のPC上で観察・操作・説明できることを確認します。チェックしただけではなく、メモに「何が起きたか」を自分の言葉で残してください。</p>

      <div className="labList">
        {labs.map((lab, index) => {
          const status = statusMap.get(lab.id) ?? 'not_started'
          return (
            <Link className="panel labRow" href={`/labs/${lab.slug}`} key={lab.id}>
              <span className="labIndex">LAB {index + 1}</span>
              <div><b>{lab.title}</b><small>{lab.description}</small><em>{lab.estimated_minutes}分</em></div>
              <span className={`labStatus ${status}`}>{status === 'completed' ? 'DONE' : status === 'in_progress' ? 'IN PROGRESS' : 'START'}</span>
            </Link>
          )
        })}
      </div>
    </main>
  )
}
