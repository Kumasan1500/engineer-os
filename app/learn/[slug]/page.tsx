'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

type Unit = {
  id: number
  skill_id: number
  slug: string
  title: string
  description: string | null
  lesson_body: string | null
  objectives: string[] | null
  key_points: string[] | null
  sort_order: number
}

type Question = {
  id: number
  prompt: string
  choices: string[] | null
  correct_answer: string
  explanation: string | null
}

type QuestionStat = {
  question_id: number
  correct_count: number
  incorrect_count: number
  current_streak: number
  mastery_score: number
  last_answered_at: string | null
  next_review_at: string | null
}

type ExistingProgress = {
  mastery_score: number
  retention_score: number
  last_score: number
  attempts: number
  status: 'not_started' | 'learning' | 'review' | 'completed'
  completed_at: string | null
}

type UnitMeta = {
  index: number
  total: number
  skillName: string
}

type Draft = {
  scroll_y: number
  answers: Record<string, string> | null
  question_ids: number[] | null
  updated_at: string
}

const QUIZ_SIZE = 5
const HEARTBEAT_SECONDS = 15

function shuffleArray<T>(items: T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function prepareQuestions(questionBank: Question[], stats: Map<number, QuestionStat>): Question[] {
  const now = Date.now()
  const ranked = questionBank.map(question => {
    const stat = stats.get(question.id)
    const due = !stat?.next_review_at || new Date(stat.next_review_at).getTime() <= now
    return {
      question,
      dueRank: due ? 0 : 1,
      mastery: stat?.mastery_score ?? 0,
      random: Math.random(),
    }
  })

  ranked.sort((a, b) => a.dueRank - b.dueRank || a.mastery - b.mastery || a.random - b.random)

  return ranked
    .slice(0, Math.min(QUIZ_SIZE, ranked.length))
    .map(({ question }) => ({
      ...question,
      choices: question.choices ? shuffleArray(question.choices) : null,
    }))
}

function restoreQuestions(questionBank: Question[], questionIds: number[]) {
  const map = new Map(questionBank.map(question => [question.id, question]))
  const restored = questionIds
    .map(id => map.get(id))
    .filter((question): question is Question => Boolean(question))
    .map(question => ({ ...question, choices: question.choices ? shuffleArray(question.choices) : null }))
  return restored.length ? restored : null
}

function nextReviewIso(streak: number, correct: boolean) {
  const days = correct ? (streak <= 1 ? 2 : streak === 2 ? 4 : streak === 3 ? 7 : streak === 4 ? 14 : 30) : 1
  const next = new Date()
  next.setDate(next.getDate() + days)
  return next.toISOString()
}

function LessonBody({ text }: { text: string | null }) {
  if (!text) return <p>教材本文はまだ準備中です。</p>
  return (
    <div className="lessonBody">
      {text.split('\n').map((line, index) => {
        const trimmed = line.trim()
        if (!trimmed) return <div className="lessonSpacer" key={index} />
        if (trimmed.startsWith('## ')) return <h3 key={index}>{trimmed.slice(3)}</h3>
        if (trimmed.startsWith('# ')) return <h2 key={index}>{trimmed.slice(2)}</h2>
        if (trimmed.startsWith('- ')) return <p className="bulletLine" key={index}>• {trimmed.slice(2)}</p>
        return <p key={index}>{line}</p>
      })}
    </div>
  )
}

export default function LearningPage() {
  const params = useParams()
  const slug = params.slug as string
  const [unit, setUnit] = useState<Unit | null>(null)
  const [questionBank, setQuestionBank] = useState<Question[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [questionStats, setQuestionStats] = useState<Map<number, QuestionStat>>(new Map())
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const submittedRef = useRef(false)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [saveMessage, setSaveMessage] = useState('')
  const [unitMeta, setUnitMeta] = useState<UnitMeta>({ index: 1, total: 1, skillName: '' })
  const [retention, setRetention] = useState(0)
  const [resumeMessage, setResumeMessage] = useState('')
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [activeSeconds, setActiveSeconds] = useState(0)
  const activeSecondsRef = useRef(0)
  const sessionIdRef = useRef<number | null>(null)
  const scrollYRef = useRef(0)
  const answersRef = useRef<Record<number, string>>({})
  const questionsRef = useRef<Question[]>([])

  useEffect(() => { answersRef.current = answers }, [answers])
  useEffect(() => { submittedRef.current = submitted }, [submitted])
  useEffect(() => { questionsRef.current = questions }, [questions])

  useEffect(() => {
    const load = async () => {
      const [{ data: unitData, error }, { data: userData }] = await Promise.all([
        supabase.from('learning_units').select('*').eq('slug', slug).single(),
        supabase.auth.getUser(),
      ])
      if (error || !unitData) {
        setLoading(false)
        return
      }
      setUnit(unitData as Unit)
      setUser(userData.user ?? null)

      const [{ data: questionData }, { data: siblingUnits }, { data: skillData }] = await Promise.all([
        supabase.from('quiz_questions').select('*').eq('unit_id', unitData.id).order('id'),
        supabase.from('learning_units').select('id,slug,sort_order').eq('skill_id', unitData.skill_id).order('sort_order'),
        supabase.from('skills').select('name').eq('id', unitData.skill_id).single(),
      ])

      const bank = (questionData ?? []) as Question[]
      setQuestionBank(bank)

      let statsMap = new Map<number, QuestionStat>()
      let draft: Draft | null = null
      if (userData.user && bank.length) {
        const [{ data: statData }, { data: progressData }, { data: draftData }] = await Promise.all([
          supabase
            .from('user_question_stats')
            .select('question_id,correct_count,incorrect_count,current_streak,mastery_score,last_answered_at,next_review_at')
            .eq('user_id', userData.user.id)
            .in('question_id', bank.map(q => q.id)),
          supabase
            .from('user_progress')
            .select('retention_score')
            .eq('user_id', userData.user.id)
            .eq('unit_id', unitData.id)
            .maybeSingle<{ retention_score: number }>(),
          supabase
            .from('user_learning_drafts')
            .select('scroll_y,answers,question_ids,updated_at')
            .eq('user_id', userData.user.id)
            .eq('unit_id', unitData.id)
            .maybeSingle<Draft>(),
        ])
        statsMap = new Map(((statData ?? []) as QuestionStat[]).map(stat => [stat.question_id, stat]))
        setRetention(progressData?.retention_score ?? 0)
        draft = draftData ?? null
      }
      setQuestionStats(statsMap)

      const restoredQuestions = draft?.question_ids?.length ? restoreQuestions(bank, draft.question_ids) : null
      const prepared = restoredQuestions ?? prepareQuestions(bank, statsMap)
      setQuestions(prepared)

      if (draft && new Date(draft.updated_at).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000) {
        const restoredAnswers: Record<number, string> = {}
        Object.entries(draft.answers ?? {}).forEach(([key, value]) => {
          if (typeof value === 'string') restoredAnswers[Number(key)] = value
        })
        setAnswers(restoredAnswers)
        scrollYRef.current = draft.scroll_y ?? 0
        setResumeMessage('前回の続きから再開しました。回答と位置は自動保存されています。')
        requestAnimationFrame(() => window.scrollTo({ top: draft?.scroll_y ?? 0, behavior: 'auto' }))
      }

      const siblings = siblingUnits ?? []
      const foundIndex = siblings.findIndex(item => item.id === unitData.id)
      setUnitMeta({
        index: foundIndex >= 0 ? foundIndex + 1 : 1,
        total: Math.max(siblings.length, 1),
        skillName: skillData?.name ?? '',
      })

      if (userData.user) {
        const { data: session } = await supabase
          .from('study_sessions')
          .insert({ user_id: userData.user.id, unit_id: unitData.id, source: 'lesson' })
          .select('id')
          .single<{ id: number }>()
        sessionIdRef.current = session?.id ?? null
      }
      setLoading(false)
    }
    load()
  }, [slug])

  useEffect(() => {
    const onScroll = () => { scrollYRef.current = Math.round(window.scrollY) }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!user || !unit || loading) return

    const saveDraft = async () => {
      if (submittedRef.current) return
      setDraftStatus('saving')
      await supabase.from('user_learning_drafts').upsert({
        user_id: user.id,
        unit_id: unit.id,
        scroll_y: scrollYRef.current,
        answers: answersRef.current,
        question_ids: questionsRef.current.map(question => question.id),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,unit_id' })
      setDraftStatus('saved')
    }

    const heartbeat = window.setInterval(async () => {
      if (document.visibilityState !== 'visible') return
      activeSecondsRef.current += HEARTBEAT_SECONDS
      setActiveSeconds(activeSecondsRef.current)
      if (sessionIdRef.current) {
        await supabase
          .from('study_sessions')
          .update({
            active_seconds: activeSecondsRef.current,
            last_active_at: new Date().toISOString(),
          })
          .eq('id', sessionIdRef.current)
      }
      await saveDraft()
    }, HEARTBEAT_SECONDS * 1000)

    const beforeUnload = () => {
      if (sessionIdRef.current) {
        void supabase.from('study_sessions').update({ ended_at: new Date().toISOString(), last_active_at: new Date().toISOString() }).eq('id', sessionIdRef.current)
      }
    }
    window.addEventListener('beforeunload', beforeUnload)

    return () => {
      window.clearInterval(heartbeat)
      window.removeEventListener('beforeunload', beforeUnload)
      void saveDraft()
      if (sessionIdRef.current) {
        void supabase.from('study_sessions').update({ ended_at: new Date().toISOString(), last_active_at: new Date().toISOString() }).eq('id', sessionIdRef.current)
      }
    }
  }, [user, unit, loading])

  useEffect(() => {
    if (!user || !unit || loading) return
    const timeout = window.setTimeout(async () => {
      if (submitted) return
      setDraftStatus('saving')
      await supabase.from('user_learning_drafts').upsert({
        user_id: user.id,
        unit_id: unit.id,
        scroll_y: scrollYRef.current,
        answers,
        question_ids: questions.map(question => question.id),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,unit_id' })
      setDraftStatus('saved')
    }, 900)
    return () => window.clearTimeout(timeout)
  }, [answers, questions, user, unit, loading, submitted])

  const correctCount = useMemo(
    () => questions.filter(q => answers[q.id] === q.correct_answer).length,
    [questions, answers]
  )
  const score = questions.length ? Math.round((correctCount / questions.length) * 100) : 0
  const unitPositionPct = Math.round((unitMeta.index / Math.max(unitMeta.total, 1)) * 100)

  const submitQuiz = async () => {
    setSubmitted(true)
    setSaveMessage('')
    if (!unit || !user || questions.length === 0) {
      if (!user) setSaveMessage('ログインすると、この結果・定着度・復習予定を保存できます。')
      return
    }

    const now = new Date().toISOString()
    const nowMs = Date.now()
    const { data: existing } = await supabase
      .from('user_progress')
      .select('mastery_score,retention_score,last_score,attempts,status,completed_at')
      .eq('user_id', user.id)
      .eq('unit_id', unit.id)
      .maybeSingle<ExistingProgress>()

    const updatedStats = new Map(questionStats)
    const statRows = questions.map(question => {
      const old = questionStats.get(question.id)
      const correct = answers[question.id] === question.correct_answer
      const streak = correct ? (old?.current_streak ?? 0) + 1 : 0
      const oldMastery = old?.mastery_score ?? 0
      const wasDue = !old?.next_review_at || new Date(old.next_review_at).getTime() <= nowMs
      const gain = wasDue ? 25 : 12
      const mastery = correct ? Math.min(100, oldMastery + gain) : Math.max(0, oldMastery - 30)
      const row = {
        user_id: user.id,
        question_id: question.id,
        correct_count: (old?.correct_count ?? 0) + (correct ? 1 : 0),
        incorrect_count: (old?.incorrect_count ?? 0) + (correct ? 0 : 1),
        current_streak: streak,
        mastery_score: mastery,
        last_answered_at: now,
        next_review_at: nextReviewIso(streak, correct),
      }
      updatedStats.set(question.id, { ...row, question_id: question.id })
      return row
    })

    const { error: statError } = await supabase
      .from('user_question_stats')
      .upsert(statRows, { onConflict: 'user_id,question_id' })

    const bankMastery = questionBank.length
      ? Math.round(questionBank.reduce((sum, question) => sum + (updatedStats.get(question.id)?.mastery_score ?? 0), 0) / questionBank.length)
      : 0

    const reviewDates = questionBank
      .map(question => updatedStats.get(question.id)?.next_review_at)
      .filter((value): value is string => Boolean(value))
      .sort()
    const earliestReview = reviewDates[0] ?? null

    const bestScore = Math.max(existing?.mastery_score ?? 0, score)
    const completedNow = score >= 80
    const completed = completedNow || existing?.status === 'completed'

    const { error: progressError } = await supabase.from('user_progress').upsert({
      user_id: user.id,
      unit_id: unit.id,
      status: completed ? 'completed' : 'review',
      mastery_score: bestScore,
      retention_score: bankMastery,
      last_score: score,
      attempts: (existing?.attempts ?? 0) + 1,
      last_studied_at: now,
      completed_at: existing?.completed_at ?? (completedNow ? now : null),
      review_due_at: earliestReview,
    }, { onConflict: 'user_id,unit_id' })

    const attemptRows = questions.map(question => ({
      user_id: user.id,
      question_id: question.id,
      answer: answers[question.id] ?? null,
      is_correct: answers[question.id] === question.correct_answer,
      score: answers[question.id] === question.correct_answer ? 1 : 0,
    }))
    const { error: attemptError } = await supabase.from('quiz_attempts').insert(attemptRows)

    if (progressError || attemptError || statError) {
      setSaveMessage(`保存エラー: ${(progressError ?? attemptError ?? statError)?.message}`)
    } else {
      setQuestionStats(updatedStats)
      setRetention(bankMastery)
      await supabase.from('user_learning_drafts').delete().eq('user_id', user.id).eq('unit_id', unit.id)
      setDraftStatus('idle')
      setSaveMessage(
        completedNow
          ? `保存しました。合格です。現在の定着度は${bankMastery}%です。期限後の正解ほどMasteryが大きく伸びます。`
          : `保存しました。80点以上で合格です。現在の定着度は${bankMastery}%です。`
      )
    }
  }

  const retryQuiz = () => {
    setAnswers({})
    setSubmitted(false)
    setSaveMessage('')
    setResumeMessage('')
    setQuestions(prepareQuestions(questionBank, questionStats))
    window.scrollTo({ top: document.body.scrollHeight * 0.58, behavior: 'smooth' })
  }

  if (loading) return <main className="pageShell narrow">Loading...</main>
  if (!unit) return <main className="pageShell narrow">教材が見つかりません。</main>

  return (
    <main className="pageShell narrow">
      <div className="breadcrumb"><Link href="/">Engineer OS</Link> / {unitMeta.skillName || 'Learning'}</div>

      <section className="unitProgressPanel">
        <div className="unitProgressTop">
          <div>
            <span className="eyebrow">UNIT POSITION</span>
            <strong>Unit {unitMeta.index} / {unitMeta.total}</strong>
          </div>
          <span>{unitPositionPct}%</span>
        </div>
        <div className="thinProgress"><div style={{ width: `${unitPositionPct}%` }} /></div>
        {user && (
          <>
            <div className="retentionInline">
              <div><span className="eyebrow">MASTERY</span><b>{retention}%</b></div>
              <div className="thinProgress masteryBar"><div style={{ width: `${retention}%` }} /></div>
            </div>
            <div className="autosaveLine">
              <span>{draftStatus === 'saving' ? '保存中…' : draftStatus === 'saved' ? '✓ 自動保存済み' : '途中保存ON'}</span>
              <span>学習時間 {Math.floor(activeSeconds / 60)}分</span>
            </div>
          </>
        )}
      </section>

      {resumeMessage && <div className="resumeNotice">↻ {resumeMessage}</div>}

      <h1>{unit.title}</h1>
      {unit.description && <p className="leadText">{unit.description}</p>}

      <section className="learningSection">
        <h2>この単元のゴール</h2>
        <ul>{(unit.objectives ?? []).map((item, index) => <li key={index}>{item}</li>)}</ul>
      </section>

      <section className="learningSection">
        <h2>講義</h2>
        <LessonBody text={unit.lesson_body} />
      </section>

      <section className="learningSection panel keyPanel">
        <h2>重要ポイント</h2>
        <ul>{(unit.key_points ?? []).map((item, index) => <li key={index}>{item}</li>)}</ul>
      </section>

      <section className="learningSection">
        <div className="quizTitleRow">
          <div>
            <h2>確認テスト</h2>
            <p className="mutedText">弱点・復習期限を優先し、問題バンクから最大{QUIZ_SIZE}問を出題。問題順・選択肢順は毎回変わります。</p>
          </div>
          <span className="quizBadge">SMART REVIEW</span>
        </div>

        {questions.map((question, index) => {
          const stat = questionStats.get(question.id)
          return (
            <article className="panel quizCard" key={question.id}>
              <div className="questionMeta">
                <span>Q{index + 1}</span>
                {user && <span>Mastery {stat?.mastery_score ?? 0}%</span>}
              </div>
              <h3>{question.prompt}</h3>
              {question.choices?.map(choice => (
                <label className="choice" key={choice}>
                  <input
                    type="radio"
                    name={`question-${question.id}`}
                    value={choice}
                    disabled={submitted}
                    checked={answers[question.id] === choice}
                    onChange={() => setAnswers(prev => ({ ...prev, [question.id]: choice }))}
                  />
                  <span>{choice}</span>
                </label>
              ))}
              {submitted && (
                <div className={answers[question.id] === question.correct_answer ? 'feedback correct' : 'feedback wrong'}>
                  <b>{answers[question.id] === question.correct_answer ? '✅ 正解' : `❌ 不正解　正解：${question.correct_answer}`}</b>
                  <p>{question.explanation}</p>
                </div>
              )}
            </article>
          )
        })}

        {!submitted ? (
          <button className="primaryButton" disabled={Object.keys(answers).length < questions.length} onClick={submitQuiz}>採点する</button>
        ) : (
          <div className="panel scorePanel">
            <span className="eyebrow">RESULT</span>
            <h2>{score}点</h2>
            <p>{correctCount} / {questions.length} 問正解</p>
            <p className={score >= 80 ? 'passText' : 'reviewText'}>{score >= 80 ? 'PASS — 80点以上で合格' : 'REVIEW — 80点以上で合格'}</p>
            {user && <p className="masteryResult">Knowledge Mastery: <b>{retention}%</b></p>}
            {saveMessage && <p className="statusMessage">{saveMessage}</p>}
            {!user && <Link className="authButton inline" href="/login">ログインして結果を保存</Link>}
            <div className="resultActions">
              <button className="secondaryButton" onClick={retryQuiz}>弱点優先で再挑戦</button>
              <Link className="primaryLink" href="/">ホームへ戻る</Link>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}
