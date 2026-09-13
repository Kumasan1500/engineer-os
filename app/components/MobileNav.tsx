'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const items = [
  { href: '/', label: 'Home', mark: '⌂' },
  { href: '/learn', label: 'Learn', mark: '◇' },
  { href: '/review', label: 'Review', mark: '↻' },
  { href: '/history', label: 'Progress', mark: '▥' },
  { href: '/more', label: 'More', mark: '•••' },
]

export default function MobileNav() {
  const pathname = usePathname()
  return (
    <nav className="mobileBottomNav" aria-label="モバイルナビゲーション">
      {items.map(item => {
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
        return (
          <Link key={item.href} href={item.href} className={active ? 'active' : ''}>
            <span className="mobileNavMark">{item.mark}</span>
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
