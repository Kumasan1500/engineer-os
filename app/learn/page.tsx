'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Skill = { id:number; slug:string; name:string; category:string; description:string|null; prerequisite_slugs?:string[] }
type Unit = { id:number; skill_id:number; slug:string; title:string; estimated_minutes:number; difficulty:number; level?:number; level_label?:string|null }
type Progress = { unit_id:number; status:string; retention_score:number; last_score:number }

export default function LearnIndex() {
  const [skills,setSkills]=useState<Skill[]>([])
  const [units,setUnits]=useState<Unit[]>([])
  const [progress,setProgress]=useState<Progress[]>([])
  useEffect(()=>{ void (async()=>{
    const [{data:s},{data:u},{data:userData}]=await Promise.all([
      supabase.from('skills').select('id,slug,name,category,description,prerequisite_slugs').order('sort_order'),
      supabase.from('learning_units').select('id,skill_id,slug,title,estimated_minutes,difficulty,level,level_label').order('skill_id').order('sort_order'),
      supabase.auth.getUser(),
    ])
    setSkills((s??[]) as Skill[]); setUnits((u??[]) as Unit[])
    if(userData.user){ const {data:p}=await supabase.from('user_progress').select('unit_id,status,retention_score,last_score').eq('user_id',userData.user.id); setProgress((p??[]) as Progress[]) }
  })() },[])
  const pmap=useMemo(()=>new Map(progress.map(p=>[p.unit_id,p])),[progress])
  const levelOneComplete=(skillSlug:string)=>{ const skill=skills.find(s=>s.slug===skillSlug); if(!skill)return false; const list=units.filter(u=>u.skill_id===skill.id&&(u.level??1)===1); return list.length>0&&list.every(u=>pmap.get(u.id)?.status==='completed') }
  const skillUnlocked=(skill:Skill)=>!(skill.prerequisite_slugs??[]).length || (skill.prerequisite_slugs??[]).every(levelOneComplete)
  return <main className="pageShell mobileFocusedShell">
    <div className="breadcrumb"><Link href="/">Engineer OS</Link> / Learn</div>
    <div className="sectionTitle"><div><span className="eyebrow">LEARNING PATH</span><h1>学ぶ</h1></div><span>{units.length} units</span></div>
    <div className="learnDomainStack">{skills.map(skill=>{
      const list=units.filter(u=>u.skill_id===skill.id)
      const done=list.filter(u=>pmap.get(u.id)?.status==='completed').length
      return <section className="panel learnDomainCard" key={skill.id}><div className="domainHeader"><div><h2>{skill.name}</h2><span>{skill.category}</span></div><strong>{list.length?Math.round(done/list.length*100):0}%</strong></div><p>{skill.description}</p><div className="unitList">{list.map((unit,i)=>{
        const prev=i?list[i-1]:null; const unlocked=skillUnlocked(skill) && (i===0 || pmap.get(prev!.id)?.status==='completed'); const p=pmap.get(unit.id)
        return unlocked?<Link className="unitRow" href={`/learn/${unit.slug}`} key={unit.id}><div><b>{unit.level_label?`${unit.level_label} · `:''}{unit.title}</b><small>{unit.estimated_minutes}分 / 難易度 {unit.difficulty}</small></div><span>{p?.status==='completed'?`✓ M${p.retention_score}%`:'→'}</span></Link>:<div className="unitRow locked" key={unit.id}><div><b>{unit.level_label?`${unit.level_label} · `:''}{unit.title}</b><small>{unit.estimated_minutes}分</small></div><span>🔒</span></div>
      })}</div></section>
    })}</div>
  </main>
}
