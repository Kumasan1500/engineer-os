'use client'
import PassiveStudyTracker from '@/app/components/PassiveStudyTracker'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

type MockExam = { id: number; name: string; question_count: number; time_limit_minutes: number; pass_score: number }
type Question = { id: number; prompt: string; choices: string[]; correct_answer: string; explanation: string | null }

type DisplayQuestion = Question & { shuffledChoices: string[] }

function shuffle<T>(items: T[]) {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function formatTime(seconds: number) {
  const safe = Math.max(0, seconds)
  const min = Math.floor(safe / 60)
  const sec = safe % 60
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export default function FoundationMockPage() {
  const [user, setUser] = useState<User | null>(null)
  const [exam, setExam] = useState<MockExam | null>(null)
  const [pool, setPool] = useState<Question[]>([])
  const [questions, setQuestions] = useState<DisplayQuestion[]>([])
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [started, setStarted] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [timeLeft, setTimeLeft] = useState(0)
  const [score, setScore] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const startedAtRef = useRef<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const [{ data: userData }, { data: examData }, { data: skillData }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('mock_exams').select('id,name,question_count,time_limit_minutes,pass_score').eq('slug', 'foundation-mock').single<MockExam>(),
        supabase.from('skills').select('id').eq('slug', 'computer-fundamentals').single<{ id: number }>(),
      ])
      setUser(userData.user ?? null)
      setExam(examData ?? null)
      if (skillData) {
        const { data: units } = await supabase.from('learning_units').select('id').eq('skill_id', skillData.id)
        const ids = (units ?? []).map(unit => unit.id)
        if (ids.length) {
          const { data } = await supabase.from('quiz_questions').select('id,prompt,choices,correct_answer,explanation').in('unit_id', ids)
          setPool((data ?? []) as Question[])
        }
      }
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (!started || submitted) return
    const timer = window.setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          window.clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [started, submitted])

  useEffect(() => {
    if (started && !submitted && timeLeft === 0 && questions.length > 0) void submitExam(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft])

  const answered = useMemo(() => questions.filter(question => answers[question.id] !== undefined).length, [questions, answers])

  const startExam = () => {
    if (!exam) return
    const selected = shuffle(pool).slice(0, Math.min(exam.question_count, pool.length)).map(question => ({
      ...question,
      shuffledChoices: shuffle(Array.isArray(question.choices) ? question.choices : []),
    }))
    setQuestions(selected)
    setAnswers({})
    setSubmitted(false)
    setScore(0)
    setCorrectCount(0)
    setMessage('')
    setTimeLeft(exam.time_limit_minutes * 60)
    startedAtRef.current = new Date().toISOString()
    setStarted(true)
  }

  const submitExam = async (timedOut = false) => {
    if (!exam || submitted || questions.length === 0) return
    const correct = questions.filter(question => answers[question.id] === question.correct_answer).length
    const finalScore = Math.round((correct / questions.length) * 100)
    setCorrectCount(correct)
    setScore(finalScore)
    setSubmitted(true)
    setMessage(timedOut ? '制限時間終了のため自動採点しました。' : '採点しました。')

    if (user) {
      await supabase.from('mock_exam_attempts').insert({
        user_id: user.id,
        mock_exam_id: exam.id,
        score: finalScore,
        correct_count: correct,
        total_questions: questions.length,
        answers,
        question_ids: questions.map(question => question.id),
        started_at: startedAtRef.current ?? new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })
    }
  }

  if (loading) return <main className="pageShell narrow"><p>模擬試験を準備中...</p></main>
  if (!user) return <main className="pageShell narrow"><div className="breadcrumb"><Link href="/">Engineer OS</Link> / Mock</div><h1>Foundation 模擬試験</h1><p className="mutedText">模試結果をReadinessへ反映するにはログインしてください。</p><Link className="primaryLink" href="/login">ログイン</Link></main>
  if (!exam) return <main className="pageShell narrow"><p>模擬試験設定が見つかりません。v0.7 SQLを確認してください。</p></main>

  if (!started) {
    return (
      <main className="pageShell narrow">
        <PassiveStudyTracker source="mock" />
        <div className="breadcrumb"><Link href="/">Engineer OS</Link> / <Link href="/readiness">Readiness</Link> / Mock</div>
        <span className="eyebrow">EXAM MODE</span>
        <h1>{exam.name}</h1>
        <p className="leadText">問題バンクから{exam.question_count}問をランダム出題し、選択肢も毎回シャッフルします。READY判定では直近{3}回を安定して{exam.pass_score}%以上にすることを要求します。</p>
        <section className="panel mockIntro">
          <div><span>問題数</span><b>{Math.min(exam.question_count, pool.length)}問</b></div>
          <div><span>制限時間</span><b>{exam.time_limit_minutes}分</b></div>
          <div><span>合格ライン</span><b>{exam.pass_score}%</b></div>
        </section>
        <p className="statusMessage">模試は「答えを覚えたか」ではなく、時間制約の中で再現できるかを見るためのものです。教材を見ずに受験してください。</p>
        <button className="primaryButton" disabled={pool.length === 0} onClick={startExam}>模擬試験を開始</button>
      </main>
    )
  }

  return (
    <main className="pageShell narrow">
      <PassiveStudyTracker source="mock" />
      <div className="mockSticky panel"><div><span className="eyebrow">TIME LEFT</span><b className={timeLeft < 300 ? 'dangerTime' : ''}>{formatTime(timeLeft)}</b></div><div><span className="eyebrow">ANSWERED</span><b>{answered}/{questions.length}</b></div></div>
      <div className="breadcrumb"><Link href="/">Engineer OS</Link> / Foundation Mock</div>
      <h1>{exam.name}</h1>

      <section className="learningSection mockQuestions">
        {questions.map((question, index) => (
          <div className="panel quizCard" key={question.id}>
            <div className="questionMeta"><span>Q{index + 1}</span><span>{answers[question.id] ? 'ANSWERED' : 'UNANSWERED'}</span></div>
            <h3>{question.prompt}</h3>
            {question.shuffledChoices.map(choice => (
              <label className="choice" key={choice}>
                <input type="radio" name={`mock-${question.id}`} checked={answers[question.id] === choice} disabled={submitted} onChange={() => setAnswers(prev => ({ ...prev, [question.id]: choice }))} />
                <span>{choice}</span>
              </label>
            ))}
            {submitted && (
              <div className={`feedback ${answers[question.id] === question.correct_answer ? 'correct' : 'wrong'}`}>
                <b>{answers[question.id] === question.correct_answer ? '✅ 正解' : `❌ 正解：${question.correct_answer}`}</b>
                <p>{question.explanation}</p>
              </div>
            )}
          </div>
        ))}
      </section>

      {!submitted ? (
        <button className="primaryButton" onClick={() => void submitExam(false)}>採点して終了</button>
      ) : (
        <section className="panel scorePanel mockResult">
          <span className="eyebrow">RESULT</span>
          <h2>{score}%</h2>
          <p>{correctCount}/{questions.length}問正解</p>
          <p className={score >= exam.pass_score ? 'passText' : 'reviewText'}>{score >= exam.pass_score ? 'PASS — この水準を複数回安定させます。' : 'REVIEW — 弱点を復習して再挑戦してください。'}</p>
          {message && <p className="mutedText">{message}</p>}
          <div className="resultActions"><button className="secondaryButton" onClick={startExam}>別セットで再挑戦</button><Link className="primaryLink" href="/readiness">Readinessを見る</Link></div>
        </section>
      )}
    </main>
  )
}