'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

type RadarItem = {
  id: string
  source: string
  title: string
  summary: string
  url: string
  area: string
  skillSlugs: string[]
  date: string
  impact: 'High' | 'Medium' | 'Low'
  ring: 'Adopt' | 'Trial' | 'Assess' | 'Watch'
  roadmapImpact: string
}

type Decision = {
  item_fingerprint: string
  decision: 'candidate' | 'watch' | 'ignore'
  note: string | null
}

type Skill = { id:number; slug:string; name:string }
type Unit = { id:number; skill_id:number }
type Progress = { unit_id:number; retention_score:number }

const alias: Record<string,string[]> = {
  network: ['network','networking'],
  'cloud-security': ['cloud-security','security'],
  sre: ['sre','observability'],
  kubernetes: ['kubernetes','k8s'],
}

function prettyTime(value:string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ja-JP', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' })
}

export default function TechRadarPage() {
  const [items,setItems] = useState<RadarItem[]>([])
  const [updatedAt,setUpdatedAt] = useState('')
  const [sourceStatus,setSourceStatus] = useState('')
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState('')
  const [filter,setFilter] = useState<'All'|'High'|'Medium'|'Low'>('All')
  const [user,setUser] = useState<User|null>(null)
  const [decisions,setDecisions] = useState<Decision[]>([])
  const [skills,setSkills] = useState<Skill[]>([])
  const [units,setUnits] = useState<Unit[]>([])
  const [progress,setProgress] = useState<Progress[]>([])

  const load = async()=>{
    setLoading(true); setError('')
    try {
      const response = await fetch('/api/trends', { cache:'no-store' })
      if (!response.ok) throw new Error(`Tech Radar API ${response.status}`)
      const payload = await response.json()
      setItems(payload.items ?? [])
      setUpdatedAt(payload.updatedAt ?? '')
      setSourceStatus(`${payload.liveSourcesSucceeded ?? 0}/${payload.liveSourcesTotal ?? 0} official live sources`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '最新情報の取得に失敗しました')
    } finally { setLoading(false) }
  }

  useEffect(()=>{
    load()
    const bootstrap = async()=>{
      const [{data:userData}, skillRes, unitRes] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('skills').select('id,slug,name'),
        supabase.from('learning_units').select('id,skill_id'),
      ])
      setUser(userData.user ?? null)
      setSkills((skillRes.data ?? []) as Skill[])
      setUnits((unitRes.data ?? []) as Unit[])
      if (userData.user) {
        const [decisionRes, progressRes] = await Promise.all([
          supabase.from('user_tech_radar_decisions').select('item_fingerprint,decision,note').eq('user_id',userData.user.id),
          supabase.from('user_progress').select('unit_id,retention_score').eq('user_id',userData.user.id),
        ])
        setDecisions((decisionRes.data ?? []) as Decision[])
        setProgress((progressRes.data ?? []) as Progress[])
      }
    }
    bootstrap()
  },[])

  const decisionMap = useMemo(()=>new Map(decisions.map(d=>[d.item_fingerprint,d])),[decisions])
  const progressMap = useMemo(()=>new Map(progress.map(p=>[p.unit_id,p.retention_score])),[progress])
  const skillMastery = useMemo(()=>{
    const map = new Map<string,number>()
    for (const skill of skills) {
      const skillUnits = units.filter(u=>u.skill_id===skill.id)
      const mastery = skillUnits.length ? Math.round(skillUnits.reduce((sum,u)=>sum+(progressMap.get(u.id) ?? 0),0)/skillUnits.length) : 0
      map.set(skill.slug,mastery)
    }
    return map
  },[skills,units,progressMap])

  const relevance = (item:RadarItem) => {
    let lowest = 100
    let matched = false
    for (const raw of item.skillSlugs) {
      const candidates = alias[raw] ?? [raw]
      for (const slug of candidates) {
        if (skillMastery.has(slug)) {
          matched = true
          lowest = Math.min(lowest, skillMastery.get(slug) ?? 0)
        }
      }
    }
    if (!matched) return '将来候補'
    if (lowest < 30) return '今は基礎優先'
    if (lowest < 70) return '学習と並行評価'
    return '優先レビュー'
  }

  const saveDecision = async(item:RadarItem,decision:Decision['decision'])=>{
    if (!user) return
    const row = { user_id:user.id, item_fingerprint:item.id, source:item.source, title:item.title, url:item.url, area:item.area, decision, note:null, decided_at:new Date().toISOString() }
    const {error} = await supabase.from('user_tech_radar_decisions').upsert(row,{onConflict:'user_id,item_fingerprint'})
    if (!error) setDecisions(prev=>[...prev.filter(d=>d.item_fingerprint!==item.id),{item_fingerprint:item.id,decision,note:null}])
  }

  const visible = filter==='All' ? items : items.filter(item=>item.impact===filter)
  const counts = useMemo(()=>({
    High:items.filter(i=>i.impact==='High').length,
    Medium:items.filter(i=>i.impact==='Medium').length,
    candidate:decisions.filter(d=>d.decision==='candidate').length,
  }),[items,decisions])

  return <main className="pageShell radarShell">
    <div className="breadcrumb"><Link href="/">Engineer OS</Link> / Tech Radar</div>
    <header className="radarHeader">
      <div>
        <div className="eyebrow">OFFICIAL-FIRST TECHNOLOGY INTELLIGENCE</div>
        <h1>Tech Radar</h1>
        <p className="mutedText">新技術を追うこと自体が目的ではありません。公式情報を監視し、あなたのロードマップ・教材・Labsを更新すべき変化だけを抽出します。</p>
      </div>
      <button className="secondaryButton" onClick={load}>最新情報を再取得</button>
    </header>

    <section className="radarMetricGrid">
      <div className="panel radarMetric"><span className="eyebrow">HIGH IMPACT</span><b>{counts.High}</b><small>優先レビュー</small></div>
      <div className="panel radarMetric"><span className="eyebrow">ASSESS</span><b>{counts.Medium}</b><small>評価候補</small></div>
      <div className="panel radarMetric"><span className="eyebrow">CURRICULUM CANDIDATES</span><b>{counts.candidate}</b><small>あなたが保存した候補</small></div>
      <div className="panel radarMetric"><span className="eyebrow">LIVE SOURCES</span><b>{sourceStatus.split(' ')[0] || '-'}</b><small>{updatedAt ? `${prettyTime(updatedAt)}更新` : '取得中'}</small></div>
    </section>

    <section className="panel radarPolicy">
      <div><span className="radarRing adopt">ADOPT</span><p>セキュリティ・廃止・Breaking Changeなど。既存教材を即レビュー。</p></div>
      <div><span className="radarRing trial">TRIAL</span><p>実務価値が高い変化。LabやProjectで小さく試す。</p></div>
      <div><span className="radarRing assess">ASSESS</span><p>重要性を評価。ロードマップへ入れるか判断。</p></div>
      <div><span className="radarRing watch">WATCH</span><p>ニュースとして監視。流行だけでは教材化しない。</p></div>
    </section>

    <div className="radarToolbar">
      {(['All','High','Medium','Low'] as const).map(value=><button key={value} className={filter===value?'active':''} onClick={()=>setFilter(value)}>{value}</button>)}
    </div>

    {loading && <p>公式ソースを確認中...</p>}
    {error && <p className="statusMessage">{error}</p>}

    <section className="radarFeed">
      {visible.map(item=>{
        const selected = decisionMap.get(item.id)?.decision
        return <article className="panel radarItem" key={item.id}>
          <div className="radarItemTop">
            <div className="radarMeta"><span className={`radarImpact ${item.impact.toLowerCase()}`}>{item.impact}</span><span className={`radarRing ${item.ring.toLowerCase()}`}>{item.ring}</span><span>{item.area}</span></div>
            <span className="radarSource">{item.source}</span>
          </div>
          <h2>{item.title}</h2>
          <p>{item.summary}</p>
          <div className="radarImpactBox"><b>Engineer OSへの影響</b><span>{item.roadmapImpact}</span><small>あなたとの関連: {relevance(item)}</small></div>
          <div className="radarItemFooter">
            <div><small>{prettyTime(item.date)}</small>{item.url && <a href={item.url} target="_blank" rel="noreferrer">公式情報 ↗</a>}</div>
            {user && <div className="radarDecisionButtons">
              <button className={selected==='candidate'?'selected':''} onClick={()=>saveDecision(item,'candidate')}>教材更新候補</button>
              <button className={selected==='watch'?'selected':''} onClick={()=>saveDecision(item,'watch')}>監視</button>
              <button className={selected==='ignore'?'selected':''} onClick={()=>saveDecision(item,'ignore')}>保留</button>
            </div>}
          </div>
        </article>
      })}
    </section>

    <section className="panel radarGuardrail">
      <h2>更新ガードレール</h2>
      <p>Tech Radarは自動でカリキュラムを書き換えません。公式情報 → 重要度判定 → あなたの現在地との関連 → 更新候補、までを自動化し、教材変更はレビュー後に行います。これにより「新しいから全部学ぶ」を避け、3〜4年で市場価値を最大化するための基礎・実務・専門性の順序を守ります。</p>
    </section>
  </main>
}
