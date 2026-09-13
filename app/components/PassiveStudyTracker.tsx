'use client'
import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

export default function PassiveStudyTracker({ source }: { source: 'mock'|'lab'|'project' }) {
  const idRef = useRef<number|null>(null)
  const secondsRef = useRef(0)
  const lastRef = useRef(Date.now())
  useEffect(()=>{
    let alive=true
    const active=()=>{lastRef.current=Date.now()}
    const events=['pointerdown','keydown','touchstart','scroll'] as const
    events.forEach(e=>window.addEventListener(e,active,{passive:true}))
    void (async()=>{
      const {data:u}=await supabase.auth.getUser(); if(!u.user||!alive)return
      const sid=typeof crypto!=='undefined'&&'randomUUID' in crypto?crypto.randomUUID():`${Date.now()}-${Math.random()}`
      const {data}=await supabase.from('study_sessions').insert({user_id:u.user.id,unit_id:null,source,device_session_id:sid,device_type:/iPhone|iPad|Android/i.test(navigator.userAgent)?'mobile':'desktop'}).select('id').single<{id:number}>()
      idRef.current=data?.id??null
    })()
    const timer=window.setInterval(async()=>{
      if(document.visibilityState==='visible'&&Date.now()-lastRef.current<=90000) secondsRef.current+=15
      if(idRef.current) await supabase.from('study_sessions').update({active_seconds:secondsRef.current,last_active_at:new Date().toISOString()}).eq('id',idRef.current)
    },15000)
    return()=>{alive=false;window.clearInterval(timer);events.forEach(e=>window.removeEventListener(e,active));if(idRef.current) void supabase.from('study_sessions').update({active_seconds:secondsRef.current,ended_at:new Date().toISOString()}).eq('id',idRef.current)}
  },[source])
  return null
}
