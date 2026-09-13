'use client'

import { useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

function isIos() {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isStandalone() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
}

export default function PWAClient() {
  const [online, setOnline] = useState(true)
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [showIosHelp, setShowIosHelp] = useState(false)

  useEffect(() => {
    setOnline(navigator.onLine)
    setInstalled(isStandalone())

    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    const onPrompt = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setInstallEvent(null)
    }

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined)
    }

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed && online) return null

  return (
    <>
      {!online && (
        <div className="networkBanner">オフラインです。キャッシュ済み画面は利用できます。進捗同期は再接続後に行われます。</div>
      )}
      {!installed && (installEvent || isIos()) && (
        <div className="installBanner">
          <div>
            <b>Engineer OSをアプリ化</b>
            <span>ホーム画面から独立起動できます。</span>
          </div>
          <button
            onClick={async () => {
              if (installEvent) {
                await installEvent.prompt()
                const choice = await installEvent.userChoice
                if (choice.outcome === 'accepted') setInstallEvent(null)
              } else {
                setShowIosHelp(true)
              }
            }}
          >
            インストール
          </button>
        </div>
      )}
      {showIosHelp && (
        <div className="iosInstallHelp" role="dialog" aria-modal="true">
          <div className="panel">
            <h2>iPhone / iPadへ追加</h2>
            <p>Safariの共有ボタン →「ホーム画面に追加」→「追加」でEngineer OSを独立アプリとして使えます。</p>
            <button className="primaryButton" onClick={() => setShowIosHelp(false)}>閉じる</button>
          </div>
        </div>
      )}
    </>
  )
}
