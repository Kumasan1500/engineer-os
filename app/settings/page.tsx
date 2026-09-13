'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Settings = {
  daily_goal_minutes: number
  reminder_time: string
  notifications_enabled: boolean
  reduce_motion: boolean
}

const defaults: Settings = {
  daily_goal_minutes: 45,
  reminder_time: '20:00',
  notifications_enabled: false,
  reduce_motion: false,
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(defaults)
  const [status, setStatus] = useState('')
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      setUserId(user?.id ?? null)
      const local = localStorage.getItem('engineer-os-settings')
      if (local) {
        try { setSettings({ ...defaults, ...JSON.parse(local) }) } catch {}
      }
      if (user) {
        const { data } = await supabase.from('user_app_settings').select('*').eq('user_id', user.id).maybeSingle()
        if (data) setSettings({
          daily_goal_minutes: data.daily_goal_minutes ?? defaults.daily_goal_minutes,
          reminder_time: data.reminder_time ?? defaults.reminder_time,
          notifications_enabled: Boolean(data.notifications_enabled),
          reduce_motion: Boolean(data.reduce_motion),
        })
      }
    }
    load()
  }, [])

  const save = async () => {
    localStorage.setItem('engineer-os-settings', JSON.stringify(settings))
    document.documentElement.dataset.reduceMotion = settings.reduce_motion ? 'true' : 'false'
    if (userId) {
      const { error } = await supabase.from('user_app_settings').upsert({
        user_id: userId,
        ...settings,
        updated_at: new Date().toISOString(),
      })
      if (error) return setStatus(error.message)
    }
    setStatus('保存しました')
  }

  const enableNotification = async () => {
    if (!('Notification' in window)) return setStatus('このブラウザは通知に対応していません')
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return setStatus('通知は許可されませんでした')
    setSettings(prev => ({ ...prev, notifications_enabled: true }))
    const registration = await navigator.serviceWorker?.ready
    if (registration) {
      await registration.showNotification('Engineer OS', {
        body: '通知テスト成功。復習や今日のミッションを見逃さないための土台が有効です。',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
      })
    } else {
      new Notification('Engineer OS', { body: '通知テスト成功' })
    }
    setStatus('通知テストを送信しました')
  }

  return (
    <main className="pageShell narrow">
      <div className="breadcrumb"><Link href="/">Engineer OS</Link> / Settings</div>
      <div className="eyebrow">V1.0 PRODUCT SETTINGS</div>
      <h1>設定</h1>
      <p className="mutedText">日々の学習負荷と端末体験を調整します。ログイン時はSupabaseへ同期します。</p>

      <section className="panel settingsPanel">
        <label>1日の学習目標（分）</label>
        <input type="number" min={10} max={360} value={settings.daily_goal_minutes} onChange={e => setSettings(prev => ({ ...prev, daily_goal_minutes: Number(e.target.value) }))} />

        <label>リマインド時刻</label>
        <input type="time" value={settings.reminder_time} onChange={e => setSettings(prev => ({ ...prev, reminder_time: e.target.value }))} />
        <small>ブラウザ通知の完全な時刻指定Pushは、将来サーバーPushを接続するとさらに強化できます。v1.0では通知権限・テスト通知・アプリ内リマインド設定を提供します。</small>

        <label className="toggleRow">
          <input type="checkbox" checked={settings.notifications_enabled} onChange={e => setSettings(prev => ({ ...prev, notifications_enabled: e.target.checked }))} />
          <span>通知を利用する</span>
        </label>
        <button className="secondaryButton" onClick={enableNotification}>通知を許可・テスト</button>

        <label className="toggleRow">
          <input type="checkbox" checked={settings.reduce_motion} onChange={e => setSettings(prev => ({ ...prev, reduce_motion: e.target.checked }))} />
          <span>アニメーションを減らす</span>
        </label>

        <button className="primaryButton" onClick={save}>設定を保存</button>
        {status && <p className="statusMessage">{status}</p>}
      </section>

      <div className="settingsLinks">
        <Link className="ghostButton" href="/backup">バックアップ / エクスポート</Link>
        <Link className="ghostButton" href="/history">学習履歴</Link>
      </div>
    </main>
  )
}
