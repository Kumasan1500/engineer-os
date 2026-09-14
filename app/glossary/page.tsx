'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Row={lookup_count:number; familiarity:number; last_viewed_at:string; next_review_at:string|null; glossary_terms:{id:number;term:string;definition:string;level:number}|null}

export default function GlossaryPage(){
 const [rows,setRows]=useState<Row[]>([]); const [loading,setLoading]=useState(true)
 useEffect(()=>{void(async()=>{const {data:{user}}=await supabase.auth.getUser(); if(!user){setLoading(false);return}; const {data}=await supabase.from('user_glossary_library').select('lookup_count,familiarity,last_viewed_at,next_review_at,glossary_terms(id,term,definition,level)').eq('user_id',user.id).order('lookup_count',{ascending:false}); setRows((data??[]) as unknown as Row[]);setLoading(false)})()},[])
 const weak=useMemo(()=>rows.filter(r=>r.lookup_count>=2||r.familiarity<50),[rows])
 return <main className="pageShell mobileFocusedShell"><div className="breadcrumb"><Link href="/">Engineer OS</Link> / 用語ライブラリ</div><div className="sectionTitle"><div><span className="eyebrow">PERSONAL GLOSSARY</span><h1>用語ライブラリ</h1></div><span>{rows.length} terms</span></div>
 <section className="panel glossarySummary"><div><span>WEAK SIGNALS</span><b>{weak.length}</b><small>複数回調べた / familiarity 50未満</small></div><p>教材でタップした用語を自動保存します。何度も調べる用語は弱点候補として、今後のMission・復習へ反映します。</p></section>
 {loading?<p>読み込み中...</p>:rows.length===0?<section className="panel emptyState"><h2>まだ用語はありません</h2><p>教材中の下線付き用語をタップすると、ここに蓄積されます。</p></section>:<div className="glossaryGrid">{rows.map(r=><article className="panel glossaryCard" key={r.glossary_terms?.id??r.last_viewed_at}><div className="glossaryCardTop"><div><span className="eyebrow">L{r.glossary_terms?.level??1}</span><h2>{r.glossary_terms?.term??'Term'}</h2></div><b>{r.lookup_count}×</b></div><p>{r.glossary_terms?.definition}</p><div className="glossaryMeta"><span>Familiarity {r.familiarity}%</span><span>最終確認 {new Date(r.last_viewed_at).toLocaleDateString('ja-JP')}</span></div></article>)}</div>}
 </main>
}
