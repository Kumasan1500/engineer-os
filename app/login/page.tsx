'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const ensureProfile = async () => {
    const { data } = await supabase.auth.getUser()
    if (!data.user) return
    await supabase.from('profiles').upsert({
      id: data.user.id,
      display_name: data.user.email?.split('@')[0] ?? 'Engineer',
      target_salary: 10000000,
      target_years: 4,
      updated_at: new Date().toISOString(),
    })
  }

  const signIn = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setMessage(`ログイン失敗: ${error.message}`)
    } else {
      await ensureProfile()
      window.location.href = '/'
    }
    setBusy(false)
  }

  const signUp = async () => {
    setBusy(true)
    setMessage('')
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setMessage(`登録失敗: ${error.message}`)
    } else if (data.session) {
      await ensureProfile()
      window.location.href = '/'
    } else {
      setMessage('登録しました。Supabaseの確認メールが届いた場合は、メール内のリンクを押してからログインしてください。')
    }
    setBusy(false)
  }

  return (
    <main className="pageShell narrow">
      <div className="breadcrumb"><Link href="/">Engineer OS</Link> / Account</div>
      <section className="panel authPanel">
        <div className="eyebrow">YOUR LEARNING IDENTITY</div>
        <h1>ログイン</h1>
        <p className="mutedText">学習結果・理解度・解放状況をスマホとPCで同期するためのアカウントです。</p>
        <form onSubmit={signIn} className="authForm">
          <label>メール</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          <label>パスワード</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={6} required />
          <button disabled={busy} type="submit">ログイン</button>
          <button disabled={busy} type="button" className="secondaryButton" onClick={signUp}>新規登録</button>
        </form>
        {message && <p className="statusMessage">{message}</p>}
      </section>
    </main>
  )
}
