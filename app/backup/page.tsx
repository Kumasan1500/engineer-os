'use client'

import Link from 'next/link'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

const tables = [
  'profiles',
  'user_progress',
  'user_question_stats',
  'study_sessions',
  'user_lab_attempts',
  'mock_exam_attempts',
  'user_projects',
  'user_tech_radar_decisions',
  'user_app_settings',
]

export default function BackupPage() {
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  const exportData = async () => {
    setBusy(true)
    setStatus('データを収集中...')
    try {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) throw new Error('ログインしてください')
      const payload: Record<string, unknown> = {
        format: 'engineer-os-backup-v1',
        exported_at: new Date().toISOString(),
        user_id: auth.user.id,
        email: auth.user.email,
      }
      for (const table of tables) {
        const key = table === 'profiles' ? 'id' : 'user_id'
        const { data, error } = await supabase.from(table).select('*').eq(key, auth.user.id)
        if (error) throw error
        payload[table] = data ?? []
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `engineer-os-backup-${new Date().toISOString().slice(0, 10)}.json`
      anchor.click()
      URL.revokeObjectURL(url)
      setStatus('バックアップを書き出しました')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '書き出しに失敗しました')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="pageShell narrow">
      <div className="breadcrumb"><Link href="/">Engineer OS</Link> / Backup</div>
      <div className="eyebrow">DATA SAFETY</div>
      <h1>バックアップ</h1>
      <p className="mutedText">通常の進捗はSupabaseへクラウド同期されています。さらに自分の学習履歴をJSONとして端末へ書き出せます。</p>
      <section className="panel backupPanel">
        <h2>Personal Data Export</h2>
        <p>進捗・問題定着度・学習時間・Labs・模試・Project・Tech Radar判断・設定をまとめて保存します。</p>
        <button className="primaryButton" onClick={exportData} disabled={busy}>{busy ? '作成中...' : 'バックアップを書き出す'}</button>
        {status && <p className="statusMessage">{status}</p>}
      </section>
      <section className="panel backupPanel">
        <h2>クラウド同期</h2>
        <p className="mutedText">学習結果はユーザー単位でSupabaseに保存され、PC・スマホ間で同じアカウントを使うと同期されます。</p>
      </section>
    </main>
  )
}
