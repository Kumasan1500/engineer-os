'use client'

import React from 'react'

export default class AppErrorBoundary extends React.Component<React.PropsWithChildren, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error('Engineer OS UI error', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="pageShell narrow">
          <div className="panel recoveryPanel">
            <div className="eyebrow">RECOVERY MODE</div>
            <h1>画面の読み込みに失敗しました</h1>
            <p className="mutedText">保存済みの学習データはSupabase側に残っています。再読み込みして復旧してください。</p>
            <button className="primaryButton" onClick={() => window.location.reload()}>再読み込み</button>
          </div>
        </main>
      )
    }
    return this.props.children
  }
}
