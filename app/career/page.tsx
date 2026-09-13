'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

type RoleTrack = { id:number; slug:string; name:string; description:string|null; target_level:string; skill_weight:number; project_weight:number; lab_weight:number; sort_order:number }
type Requirement = { role_track_id:number; skill_slug:string; weight:number; target_mastery:number }
type Skill = { id:number; slug:string; name:string }
type Unit = { id:number; skill_id:number }
type Progress = { unit_id:number; retention_score:number; status:string }
type Project = { id:number; slug:string; title:string; description:string|null; role_slugs:string[]; estimated_hours:number; difficulty:number; portfolio_worthy:boolean; sort_order:number }
type UserProject = { project_id:number; status:string; repo_url:string|null }
type Lab = { id:number }
type LabAttempt = { lab_id:number; status:string }
type Milestone = { id:number; phase:number; title:string; horizon:string; objective:string; exit_criteria:string[]; sort_order:number }

const aliases: Record<string,string[]> = {
  network: ['network','networking'],
  'git-github': ['git-github','git'],
  'ci-cd': ['ci-cd','cicd'],
  sre: ['sre','observability'],
  'cloud-security': ['cloud-security','security'],
  kubernetes: ['kubernetes','k8s'],
}

function matchSkill(requirementSlug:string, skills:Skill[]) {
  const candidates = aliases[requirementSlug] ?? [requirementSlug]
  return skills.find(skill => candidates.includes(skill.slug))
}

export default function CareerPage() {
  const [user,setUser] = useState<User|null>(null)
  const [roles,setRoles] = useState<RoleTrack[]>([])
  const [requirements,setRequirements] = useState<Requirement[]>([])
  const [skills,setSkills] = useState<Skill[]>([])
  const [units,setUnits] = useState<Unit[]>([])
  const [progress,setProgress] = useState<Progress[]>([])
  const [projects,setProjects] = useState<Project[]>([])
  const [userProjects,setUserProjects] = useState<UserProject[]>([])
  const [labs,setLabs] = useState<Lab[]>([])
  const [labAttempts,setLabAttempts] = useState<LabAttempt[]>([])
  const [milestones,setMilestones] = useState<Milestone[]>([])
  const [loading,setLoading] = useState(true)

  useEffect(()=>{ const load = async()=>{
    const [{data:userData}, roleRes, reqRes, skillRes, unitRes, projectRes, labRes, milestoneRes] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from('role_tracks').select('*').eq('is_active',true).order('sort_order'),
      supabase.from('role_skill_requirements').select('*'),
      supabase.from('skills').select('id,slug,name').order('sort_order'),
      supabase.from('learning_units').select('id,skill_id'),
      supabase.from('practical_projects').select('id,slug,title,description,role_slugs,estimated_hours,difficulty,portfolio_worthy,sort_order').eq('is_active',true).order('sort_order'),
      supabase.from('hands_on_labs').select('id').eq('is_active',true),
      supabase.from('career_milestones').select('*').order('sort_order'),
    ])
    setUser(userData.user ?? null)
    setRoles((roleRes.data ?? []) as RoleTrack[])
    setRequirements((reqRes.data ?? []) as Requirement[])
    setSkills((skillRes.data ?? []) as Skill[])
    setUnits((unitRes.data ?? []) as Unit[])
    setProjects((projectRes.data ?? []) as Project[])
    setLabs((labRes.data ?? []) as Lab[])
    setMilestones((milestoneRes.data ?? []) as Milestone[])
    if (userData.user) {
      const [progressRes, projectAttemptRes, labAttemptRes] = await Promise.all([
        supabase.from('user_progress').select('unit_id,retention_score,status').eq('user_id',userData.user.id),
        supabase.from('user_projects').select('project_id,status,repo_url').eq('user_id',userData.user.id),
        supabase.from('user_lab_attempts').select('lab_id,status').eq('user_id',userData.user.id),
      ])
      setProgress((progressRes.data ?? []) as Progress[])
      setUserProjects((projectAttemptRes.data ?? []) as UserProject[])
      setLabAttempts((labAttemptRes.data ?? []) as LabAttempt[])
    }
    setLoading(false)
  }; load() },[])

  const progressMap = useMemo(()=>new Map(progress.map(p=>[p.unit_id,p])),[progress])
  const projectMap = useMemo(()=>new Map(userProjects.map(p=>[p.project_id,p])),[userProjects])
  const skillMastery = useMemo(()=>{
    const map = new Map<string,number>()
    for (const skill of skills) {
      const skillUnits = units.filter(unit=>unit.skill_id===skill.id)
      if (!skillUnits.length) { map.set(skill.slug,0); continue }
      const avg = Math.round(skillUnits.reduce((sum,unit)=>sum+(progressMap.get(unit.id)?.retention_score ?? 0),0)/skillUnits.length)
      map.set(skill.slug,avg)
    }
    return map
  },[skills,units,progressMap])
  const labPct = labs.length ? Math.round(labs.filter(l=>labAttempts.find(a=>a.lab_id===l.id && a.status==='completed')).length/labs.length*100) : 0

  const roleCards = useMemo(()=> roles.map(role=>{
    const reqs = requirements.filter(r=>r.role_track_id===role.id)
    const weightedMax = reqs.reduce((s,r)=>s+r.weight,0) || 1
    const skillScore = Math.round(reqs.reduce((sum,req)=>{
      const skill = matchSkill(req.skill_slug,skills)
      const mastery = skill ? (skillMastery.get(skill.slug) ?? 0) : 0
      return sum + Math.min(100, Math.round((mastery/req.target_mastery)*100))*req.weight
    },0)/weightedMax)
    const relevantProjects = projects.filter(project=>project.role_slugs.includes(role.slug))
    const done = relevantProjects.filter(project=>projectMap.get(project.id)?.status==='completed').length
    const projectScore = relevantProjects.length ? Math.round(done/relevantProjects.length*100) : 0
    const readiness = Math.round((skillScore*role.skill_weight + projectScore*role.project_weight + labPct*role.lab_weight)/100)
    const gaps = reqs.map(req=>{
      const skill = matchSkill(req.skill_slug,skills)
      return {name:skill?.name ?? req.skill_slug, mastery:skill ? (skillMastery.get(skill.slug) ?? 0) : 0, target:req.target_mastery}
    }).filter(x=>x.mastery<x.target).sort((a,b)=>(a.mastery/a.target)-(b.mastery/b.target)).slice(0,3)
    const nextProject = relevantProjects.find(project=>projectMap.get(project.id)?.status!=='completed')
    return {role,readiness,skillScore,projectScore,gaps,nextProject,done,total:relevantProjects.length}
  }),[roles,requirements,skills,skillMastery,projects,projectMap,labPct])

  if (loading) return <main className="pageShell"><p>Career OSを計算中...</p></main>
  if (!user) return <main className="pageShell narrow"><div className="breadcrumb"><Link href="/">Engineer OS</Link> / Career OS</div><h1>Career OS</h1><p className="mutedText">市場価値Readinessを計算するにはログインしてください。</p><Link className="primaryLink" href="/login">ログイン</Link></main>

  return <main className="pageShell">
    <div className="breadcrumb"><Link href="/">Engineer OS</Link> / Career OS</div>
    <div className="sectionTitle"><h1>Career OS</h1><span>v0.8</span></div>
    <p className="leadText">年収1000万円超は資格だけでは届きません。知識・Hands-on・再現可能な成果物を、職種ごとに証拠ベースで積み上げます。Readinessは目標達成を保証するものではなく、次に埋めるべきギャップを示す指標です。</p>

    <section className="careerRoleGrid">
      {roleCards.map(card=><article className="panel careerRoleCard" key={card.role.id}>
        <div className="careerRoleHeader"><div><span className="eyebrow">{card.role.target_level.toUpperCase()} ROLE</span><h2>{card.role.name}</h2></div><strong>{card.readiness}%</strong></div>
        <p>{card.role.description}</p>
        <div className="careerPillars">
          <div><span>SKILLS</span><b>{card.skillScore}%</b></div>
          <div><span>PROJECTS</span><b>{card.projectScore}%</b><small>{card.done}/{card.total}</small></div>
          <div><span>HANDS-ON</span><b>{labPct}%</b></div>
        </div>
        <div className="thinProgress careerBar"><div style={{width:`${card.readiness}%`}} /></div>
        <div className="careerGaps"><span className="eyebrow">NEXT GAPS</span>{card.gaps.length ? card.gaps.map(g=><div key={g.name}><b>{g.name}</b><span>{g.mastery}% → {g.target}%</span></div>) : <p>主要スキル目標をクリアしています。</p>}</div>
        {card.nextProject && <Link className="careerNextProject" href={`/projects/${card.nextProject.slug}`}><span>NEXT PROJECT</span><b>{card.nextProject.title}</b><small>約{card.nextProject.estimated_hours}時間 / 難易度 {card.nextProject.difficulty}</small></Link>}
      </article>)}
    </section>

    <div className="careerActions"><Link className="primaryLink" href="/projects">実務プロジェクトを見る</Link><Link className="secondaryButton linkButton" href="/readiness">資格Readinessを見る</Link></div>

    <section className="careerRoadmap">
      <div className="sectionTitle"><h2>3〜4年で市場価値を最大化するロードマップ</h2><span>{milestones.length} phases</span></div>
      {milestones.map(item=><article className="panel milestoneRow" key={item.id}>
        <div className="milestonePhase">PHASE {item.phase}</div>
        <div><div className="milestoneTitle"><h3>{item.title}</h3><span>{item.horizon}</span></div><p>{item.objective}</p><ul>{(item.exit_criteria ?? []).map((x,i)=><li key={i}>{x}</li>)}</ul></div>
      </article>)}
    </section>
  </main>
}
