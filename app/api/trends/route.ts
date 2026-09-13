import { NextResponse } from 'next/server'

type Source = {
  name: string
  url: string
  area: string
  skillSlugs: string[]
}

type RadarItem = {
  id: string
  source: string
  title: string
  summary: string
  url: string
  area: string
  skillSlugs: string[]
  date: string
  impact: 'High' | 'Medium' | 'Low'
  ring: 'Adopt' | 'Trial' | 'Assess' | 'Watch'
  roadmapImpact: string
}

const sources: Source[] = [
  {
    name: 'AWS What’s New',
    url: 'https://aws.amazon.com/about-aws/whats-new/recent/feed/',
    area: 'AWS / Cloud',
    skillSlugs: ['aws', 'network', 'cloud-security'],
  },
  {
    name: 'Kubernetes',
    url: 'https://kubernetes.io/feed.xml',
    area: 'Kubernetes',
    skillSlugs: ['kubernetes', 'docker', 'sre'],
  },
  {
    name: 'CNCF',
    url: 'https://www.cncf.io/feed/',
    area: 'Cloud Native',
    skillSlugs: ['kubernetes', 'sre', 'docker'],
  },
  {
    name: 'CISA',
    url: 'https://www.cisa.gov/cybersecurity-advisories/all.xml',
    area: 'Security',
    skillSlugs: ['cloud-security', 'network', 'aws'],
  },
]

const decode = (value: string) => value
  .replace(/<!\[CDATA\[|\]\]>/g, '')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&#39;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

function tagText(xml: string, tag: string) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')
  const match = xml.match(re)
  return match ? decode(match[1]) : ''
}

function itemUrl(xml: string) {
  const linkText = tagText(xml, 'link')
  if (linkText.startsWith('http')) return linkText
  const atomHref = xml.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i)?.[1]
  return atomHref ?? ''
}

function impactFor(title: string, summary: string): RadarItem['impact'] {
  const text = `${title} ${summary}`.toLowerCase()
  const high = [
    'breaking', 'deprecat', 'end of support', 'end-of-life', 'security', 'cve-',
    'vulnerability', 'critical', 'iam', 'waf', 'shield', 'kubernetes 1.',
    'terraform 2.', 'migration required', 'action required',
  ]
  if (high.some(word => text.includes(word))) return 'High'
  const medium = ['release', 'general availability', 'available', 'launch', 'policy', 'network', 'container', 'observability', 'terraform', 'kubernetes', 'cloudwatch']
  if (medium.some(word => text.includes(word))) return 'Medium'
  return 'Low'
}

function ringFor(impact: RadarItem['impact'], title: string): RadarItem['ring'] {
  const text = title.toLowerCase()
  if (impact === 'High' && /(security|cve|deprecat|end of support|breaking|action required)/.test(text)) return 'Adopt'
  if (impact === 'High') return 'Trial'
  if (impact === 'Medium') return 'Assess'
  return 'Watch'
}

function roadmapImpact(area: string, impact: RadarItem['impact']) {
  if (impact === 'High') return `${area}の既存教材・Labs・問題バンクを優先レビューする候補です。`
  if (impact === 'Medium') return `${area}のロードマップへ追加すべきか評価する候補です。`
  return `${area}の動向として監視し、複数回重要性が確認できたら教材化します。`
}

function hash(input: string) {
  let h = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}

async function fetchSource(source: Source): Promise<RadarItem[]> {
  const response = await fetch(source.url, {
    next: { revalidate: 1800 },
    headers: { 'User-Agent': 'EngineerOS-TechRadar/0.9 (+local-learning-app)' },
  })
  if (!response.ok) throw new Error(`${source.name}: ${response.status}`)
  const xml = await response.text()
  const chunks = xml.match(/<item[\s\S]*?<\/item>|<entry[\s\S]*?<\/entry>/gi)?.slice(0, 8) ?? []
  return chunks.map(chunk => {
    const title = tagText(chunk, 'title') || 'Official update'
    const summary = (tagText(chunk, 'description') || tagText(chunk, 'summary') || tagText(chunk, 'content') || '公式更新を検出しました。').slice(0, 420)
    const date = tagText(chunk, 'pubDate') || tagText(chunk, 'updated') || tagText(chunk, 'published') || 'Latest'
    const url = itemUrl(chunk)
    const impact = impactFor(title, summary)
    return {
      id: hash(`${source.name}|${title}|${url}`),
      source: source.name,
      title,
      summary,
      url,
      area: source.area,
      skillSlugs: source.skillSlugs,
      date: date.slice(0, 64),
      impact,
      ring: ringFor(impact, title),
      roadmapImpact: roadmapImpact(source.area, impact),
    }
  })
}

const fallback: RadarItem[] = [
  {
    id: 'fallback-aws-nx-20260908',
    source: 'AWS What’s New',
    title: 'Nx Plugin for AWS adds repeatable app scaffolding with CDK / Terraform patterns',
    summary: 'AWS announced an Nx plugin that generates deployable application components with infrastructure, security, observability and type-safe integration patterns.',
    url: 'https://aws.amazon.com/about-aws/whats-new/2026/09/nx-plugin-for-aws/',
    area: 'AWS / Cloud',
    skillSlugs: ['aws', 'terraform', 'cloud-security'],
    date: '2026-09-08',
    impact: 'Medium',
    ring: 'Assess',
    roadmapImpact: 'IaC・Observability・Securityを統合した実務プロジェクトの題材候補です。',
  },
  {
    id: 'fallback-cncf-karmada-20260908',
    source: 'CNCF',
    title: 'Karmada graduates in CNCF for multi-cluster / multi-cloud Kubernetes orchestration',
    summary: 'Karmada reached CNCF graduated maturity, strengthening the case for multi-cluster Kubernetes knowledge at advanced SRE / platform stages.',
    url: 'https://www.cncf.io/announcements/2026/09/07/cloud-native-computing-foundation-announces-karmada-graduation/',
    area: 'Cloud Native',
    skillSlugs: ['kubernetes', 'sre'],
    date: '2026-09-08',
    impact: 'Medium',
    ring: 'Assess',
    roadmapImpact: '基礎Kubernetes完了後の上級Platform/SRE候補。今すぐ基礎ロードマップを変更する必要はありません。',
  },
  {
    id: 'fallback-terraform-20260905',
    source: 'HashiCorp',
    title: 'HCP Terraform policy sets can target workspaces by tags',
    summary: 'Recent HCP Terraform changes expanded policy-set targeting. Governance and policy-as-code remain important after Terraform fundamentals.',
    url: 'https://developer.hashicorp.com/terraform/cloud-docs/changelog',
    area: 'Terraform / IaC',
    skillSlugs: ['terraform', 'cloud-security'],
    date: '2026-09-05',
    impact: 'Medium',
    ring: 'Assess',
    roadmapImpact: 'Terraform基礎の後にPolicy as Code / Governance演習を追加する候補です。',
  },
]

export async function GET() {
  const results = await Promise.allSettled(sources.map(fetchSource))
  const live = results.flatMap(result => result.status === 'fulfilled' ? result.value : [])
  const errors = results.flatMap((result, index) => result.status === 'rejected' ? [`${sources[index].name}: ${String(result.reason)}`] : [])

  const merged = [...live, ...(live.length < 5 ? fallback : [])]
  const unique = Array.from(new Map(merged.map(item => [item.id, item])).values())
    .sort((a, b) => ({ High: 3, Medium: 2, Low: 1 }[b.impact] - { High: 3, Medium: 2, Low: 1 }[a.impact]))
    .slice(0, 24)

  return NextResponse.json({
    items: unique,
    updatedAt: new Date().toISOString(),
    sourcePolicy: 'official-first',
    refreshMinutes: 30,
    liveSourcesSucceeded: results.filter(result => result.status === 'fulfilled').length,
    liveSourcesTotal: sources.length,
    errors,
  })
}
