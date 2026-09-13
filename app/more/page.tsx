import Link from 'next/link'

const links=[
  ['/career','Career OS','職種別Readiness・市場価値ロードマップ'],
  ['/tech-radar','Tech Radar','公式情報から技術変化を追跡'],
  ['/readiness','資格・実践','模試・Hands-on・資格Readiness'],
  ['/projects','Projects','実務成果物・GitHub Evidence'],
  ['/labs','Labs','Hands-on演習'],
  ['/settings','設定','学習目標・通知・バックアップ'],
]
export default function MorePage(){return <main className="pageShell mobileFocusedShell"><div className="breadcrumb"><Link href="/">Engineer OS</Link> / More</div><div className="sectionTitle"><div><span className="eyebrow">ENGINEER OS</span><h1>More</h1></div><span>v1.1</span></div><div className="moreMenu">{links.map(([href,title,desc])=><Link className="panel moreMenuRow" href={href} key={href}><div><b>{title}</b><span>{desc}</span></div><i>→</i></Link>)}</div></main>}
