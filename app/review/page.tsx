'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Unit={id:number;slug:string;title:string;estimated_minutes:number}
type Progress={unit_id:number;retention_score:number;review_due_at:string|null;last_score:number;attempts:number}
export default function ReviewPage(){
  const [units,setUnits]=useState<Unit[]>([]); const [progress,setProgress]=useState<Progress[]>([]); const [logged,setLogged]=useState(false)
  useEffect(()=>{void(async()=>{const [{data:u},{data:userData}]=await Promise.all([supabase.from('learning_units').select('id,slug,title,estimated_minutes'),supabase.auth.getUser()]); setUnits((u??[]) as Unit[]); setLogged(Boolean(userData.user)); if(userData.user){const {data:p}=await supabase.from('user_progress').select('unit_id,retention_score,review_due_at,last_score,attempts').eq('user_id',userData.user.id); setProgress((p??[]) as Progress[])}})()},[])
  const map=useMemo(()=>new Map(units.map(u=>[u.id,u])),[units]); const now=Date.now();
  const due=progress.filter(p=>p.review_due_at&&new Date(p.review_due_at).getTime()<=now).sort((a,b)=>a.retention_score-b.retention_score)
  const upcoming=progress.filter(p=>p.review_due_at&&new Date(p.review_due_at).getTime()>now).sort((a,b)=>new Date(a.review_due_at!).getTime()-new Date(b.review_due_at!).getTime()).slice(0,8)
  if(!logged)return <main className="pageShell mobileFocusedShell"><h1>Review</h1><p>ログインすると復習キューを表示します。</p><Link className="primaryLink" href="/login">ログイン</Link></main>
  return <main className="pageShell mobileFocusedShell"><div className="breadcrumb"><Link href="/">Engineer OS</Link> / Review</div><div className="sectionTitle"><div><span className="eyebrow">SPACED REVIEW</span><h1>復習</h1></div><span>{due.length} due</span></div>
    <section className="panel reviewHero"><span className="eyebrow">REVIEW DUE</span><b>{due.length}</b><p>{due.length?'定着度が低いものから回収します。':'今すぐ必要な復習はありません。'}</p></section>
    <div className="reviewQueue">{due.map(p=>{const u=map.get(p.unit_id); if(!u)return null; return <Link className="panel reviewQueueRow" href={`/learn/${u.slug}`} key={p.unit_id}><div><b>{u.title}</b><small>Mastery {p.retention_score}% ・ 前回 {p.last_score}点 ・ {p.attempts}回</small></div><span>復習 →</span></Link>})}</div>
    <section className="learningSection"><h2>次の復習予定</h2><div className="historyList">{upcoming.map(p=>{const u=map.get(p.unit_id);if(!u)return null;return <div className="panel historyRow" key={p.unit_id}><div><b>{u.title}</b><small>Mastery {p.retention_score}%</small></div><span>{new Intl.DateTimeFormat('ja-JP',{month:'numeric',day:'numeric'}).format(new Date(p.review_due_at!))}</span></div>})}</div></section>
  </main>
}
