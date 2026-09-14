import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

async function loadEnv() {
  const envPath = path.join(root, '.env.local')
  const raw = await fs.readFile(envPath, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx < 1) continue
    const key = trimmed.slice(0, idx).trim()
    const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

await loadEnv()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('\n[Engineer OS] content sync needs these values in .env.local:')
  console.error('NEXT_PUBLIC_SUPABASE_URL=...')
  console.error('SUPABASE_SERVICE_ROLE_KEY=...  (server-only; never expose it in NEXT_PUBLIC_ variables)\n')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
})
const packPath = path.join(root, 'content', 'content-pack.json')
const pack = JSON.parse(await fs.readFile(packPath, 'utf8'))

let unitCount = 0
let questionCount = 0
let glossaryCount = 0

for (const skill of pack.skills ?? []) {
  const { data: skillRow, error: skillErr } = await supabase
    .from('skills')
    .upsert({
      slug: skill.slug,
      name: skill.name,
      category: skill.category,
      description: skill.description ?? null,
      sort_order: skill.sort_order ?? 0,
      is_active: true,
      prerequisite_slugs: skill.prerequisite_slugs ?? [],
      level_count: skill.level_count ?? 5,
    }, { onConflict: 'slug' })
    .select('id')
    .single()
  if (skillErr) throw skillErr

  for (const unit of skill.units ?? []) {
    const { data: unitRow, error: unitErr } = await supabase
      .from('learning_units')
      .upsert({
        skill_id: skillRow.id,
        slug: unit.slug,
        title: unit.title,
        description: unit.description ?? null,
        lesson_body: unit.lesson_body ?? null,
        objectives: unit.objectives ?? [],
        key_points: unit.key_points ?? [],
        difficulty: unit.difficulty ?? 1,
        estimated_minutes: unit.estimated_minutes ?? 15,
        sort_order: unit.sort_order ?? 0,
        is_active: true,
        content_version: pack.version,
        level: unit.level ?? 1,
        level_label: unit.level_label ?? null,
        track: unit.track ?? skill.slug,
        competency_tags: unit.competency_tags ?? [],
        source_refs: unit.source_refs ?? [],
      }, { onConflict: 'slug' })
      .select('id')
      .single()
    if (unitErr) throw unitErr
    unitCount += 1

    const questionPayloads = (unit.questions ?? []).map(question => ({
      content_key: question.content_key,
      unit_id: unitRow.id,
      question_type: question.question_type ?? 'multiple_choice',
      prompt: question.prompt,
      choices: question.choices ?? null,
      correct_answer: question.correct_answer,
      explanation: question.explanation ?? null,
      difficulty: question.difficulty ?? 1,
      tags: question.tags ?? [],
      why_correct: question.why_correct ?? null,
      why_others_wrong: question.why_others_wrong ?? {},
      related_knowledge: question.related_knowledge ?? null,
      practical_use: question.practical_use ?? null,
      exam_traps: question.exam_traps ?? null,
    }))

    // v2.0: sync large question banks in batches. Upsert by content_key preserves
    // existing question ids/history while making 5k+ question packs practical.
    const BATCH_SIZE = 200
    for (let offset = 0; offset < questionPayloads.length; offset += BATCH_SIZE) {
      const batch = questionPayloads.slice(offset, offset + BATCH_SIZE)
      const { error: qErr } = await supabase
        .from('quiz_questions')
        .upsert(batch, { onConflict: 'content_key' })
      if (qErr) throw qErr
      questionCount += batch.length
    }

  }
}


// Sync glossary terms after curriculum so skill ids are available.
for (const term of pack.glossary_terms ?? []) {
  const { data: skillRow } = await supabase.from('skills').select('id').eq('slug', term.skill_slug).maybeSingle()
  const { error } = await supabase.from('glossary_terms').upsert({
    term: term.term,
    definition: term.definition,
    skill_id: skillRow?.id ?? null,
    aliases: term.aliases ?? [],
    level: term.level ?? 1,
    related_terms: term.related_terms ?? [],
    content_version: pack.version,
  }, { onConflict: 'term' })
  if (error) throw error
  glossaryCount += 1
}

console.log(`\n✅ Engineer OS content sync complete`)
console.log(`   Pack: ${pack.version}`)
console.log(`   Units synced: ${unitCount}`)
console.log(`   Questions synced: ${questionCount}`)
console.log(`   Glossary terms synced: ${glossaryCount}`)
console.log('   No manual SQL entry is needed for these lessons/questions.\n')
