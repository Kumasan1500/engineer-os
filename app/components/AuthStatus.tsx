'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export default function AuthStatus() {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  if (!user) {
    return <Link className="authButton" href="/login">ログイン</Link>
  }

  return (
    <button
      className="authButton"
      onClick={async () => {
        await supabase.auth.signOut()
        window.location.reload()
      }}
    >
      ログアウト
    </button>
  )
}
