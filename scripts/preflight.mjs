import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const required = [
  'app/page.tsx',
  'app/learn/[slug]/page.tsx',
  'app/readiness/page.tsx',
  'app/career/page.tsx',
  'app/tech-radar/page.tsx',
  'app/settings/page.tsx',
  'app/backup/page.tsx',
  'public/manifest.webmanifest',
  'public/sw.js',
  'sql/v1.0_productization.sql',
]
const missing = required.filter(file => !fs.existsSync(path.join(root, file)))
if (missing.length) {
  console.error('Preflight failed. Missing files:\n' + missing.join('\n'))
  process.exit(1)
}
JSON.parse(fs.readFileSync(path.join(root, 'public/manifest.webmanifest'), 'utf8'))
console.log('✅ Engineer OS v1.0 preflight passed')
console.log('Required product files are present and manifest JSON is valid.')
