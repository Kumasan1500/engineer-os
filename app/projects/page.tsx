'use client'
import Link from 'next/link'
import { useEffect,useMemo,useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

type Project={id:number;slug:string;title:string;description:string|null;role_slugs:string[];required_skill_slugs:string[];estimated_hours:number;difficulty:number;portfolio_worthy:boolean;sort_order:number}
type Attempt={project_id:number;status:string;repo_url:string|null}

export default function ProjectsPage(){
 const [user,setUser]=useState<User|null>(null); const [projects,setProjects]=useState<Project[]>([]); const [attempts,setAttempts]=useState<Attempt[]>([]); const [loading,setLoading]=useState(true)
 useEffect(()=>{const load=async()=>{const [{data:userData},{data:projectData}]=await Promise.all([supabase.auth.getUser(),supabase.from('practical_projects').select('*').eq('is_active',true).order('sort_order')]); setUser(userData.user??null); setProjects((projectData??[]) as Project[]); if(userData.user){const {data}=await supabase.from('user_projects').select('project_id,status,repo_url').eq('user_id',userData.user.id);setAttempts((data??[]) as Attempt[])} setLoading(false)};load()},[])
 const statusMap=useMemo(()=>new Map(attempts.map(x=>[x.project_id,x])),[attempts]); const done=projects.filter(p=>statusMap.get(p.id)?.status==='completed').length
 if(loading)return <main className="pageShell"><p>Projectsを読み込み中...</p></main>
 if(!user)return <main className="pageShell narrow"><div className="breadcrumb"><Link href="/">Engineer OS</Link> / Projects</div><h1>実務プロジェクト</h1><p className="mutedText">成果物の進捗を保存するにはログインしてください。</p><Link className="primaryLink" href="/login">ログイン</Link></main>
 return <main className="pageShell"><div className="breadcrumb"><Link href="/">Engineer OS</Link> / <Link href="/career">Career OS</Link> / Projects</div><div className="sectionTitle"><h1>実務プロジェクト</h1><span>{done}/{projects.length} completed</span></div><p className="leadText">「勉強した」を「設計・構築・障害対応を証明できる」に変える成果物です。完了にはGitHub URLと、自分の判断を説明するEvidenceを残します。</p><div className="projectGrid">{projects.map(project=>{const a=statusMap.get(project.id);return <Link href={`/projects/${project.slug}`} className="panel projectCard" key={project.id}><div className="projectCardTop"><span className="eyebrow">DIFFICULTY {project.difficulty} · ~{project.estimated_hours}H</span><span className={`projectStatus ${a?.status??'not_started'}`}>{a?.status==='completed'?'DONE':a?.status==='in_progress'?'IN PROGRESS':'START'}</span></div><h2>{project.title}</h2><p>{project.description}</p><div className="projectTags">{project.role_slugs.map(role=><span key={role}>{role}</span>)}</div>{a?.repo_url&&<small className="repoEvidence">✓ GitHub evidence linked</small>}</Link>})}</div></main>
}
