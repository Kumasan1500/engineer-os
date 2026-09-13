import './globals.css'
import type { Metadata, Viewport } from 'next'
import PWAClient from '@/app/components/PWAClient'
import AppErrorBoundary from '@/app/components/AppErrorBoundary'
import MobileNav from '@/app/components/MobileNav'

export const metadata: Metadata = {
  title: { default: 'Engineer OS', template: '%s | Engineer OS' },
  description: '技術・資格・実務・キャリアを一体管理するエンジニア成長OS',
  manifest: '/manifest.webmanifest',
  applicationName: 'Engineer OS',
  appleWebApp: { capable: true, title: 'Engineer OS', statusBarStyle: 'black-translucent' },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
}

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>
        <PWAClient />
        <AppErrorBoundary>{children}</AppErrorBoundary>
        <MobileNav />
      </body>
    </html>
  )
}
