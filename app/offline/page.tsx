import Link from 'next/link'

export default function OfflinePage() {
  return (
    <main className="pageShell narrow">
      <div className="panel recoveryPanel">
        <div className="eyebrow">OFFLINE</div>
        <h1>ネットワークに接続できません</h1>
        <p className="mutedText">以前開いたページはキャッシュから表示できる場合があります。オンラインへ戻るとSupabase同期が再開します。</p>
        <Link href="/" className="primaryLink">ホームへ戻る</Link>
      </div>
    </main>
  )
}
