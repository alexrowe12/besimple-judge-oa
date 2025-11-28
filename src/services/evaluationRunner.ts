import { supabase } from '@/lib/supabase'
import { evaluate } from './llm'
import type { EvaluationResponse, Attachment } from './llm'
import { getAttachmentsForQuestion } from './storage'
import { validateJudge, type ValidatedJudge } from '@/lib/validation'

export interface EvaluationTask {
  questionId: string
  questionText: string
  questionType: string
  submissionId: string
  answer: {
    choice?: string
    reasoning?: string
    [key: string]: unknown
  }
  judge: ValidatedJudge
}

export interface RunProgress {
  total: number
  completed: number
  failed: number
  skipped: number
  current?: string
}

export interface RunResult {
  total: number
  completed: number
  failed: number
  skipped: number
  errors: string[]
}

export interface TasksResult {
  tasks: EvaluationTask[]
  skippedCount: number
}

export async function getEvaluationTasks(queueId: string): Promise<EvaluationTask[]> {
  const { tasks } = await getEvaluationTasksWithSkipped(queueId)
  return tasks
}

export async function getEvaluationTasksWithSkipped(queueId: string): Promise<TasksResult> {
  // Get all questions with their answers for this queue
  const { data: questions, error: questionsError } = await supabase
    .from('questions')
    .select(`
      id,
      template_id,
      question_type,
      question_text,
      submission_id,
      submissions!inner(queue_id),
      answers(choice, reasoning, raw_value)
    `)
    .eq('submissions.queue_id', queueId)

  if (questionsError) throw questionsError

  // Get all judge assignments for this queue
  const { data: assignments, error: assignmentsError } = await supabase
    .from('judge_assignments')
    .select(`
      question_template_id,
      judges(id, name, system_prompt, model_provider, model_name, prompt_fields)
    `)
    .eq('queue_id', queueId)

  if (assignmentsError) throw assignmentsError

  // Get existing evaluations for questions in this queue to avoid duplicates
  const questionIds = (questions || []).map((q) => q.id)
  const { data: existingEvaluations, error: evalError } = await supabase
    .from('evaluations')
    .select('question_id, judge_id')
    .in('question_id', questionIds.length > 0 ? questionIds : [''])

  if (evalError) throw evalError

  // Create a Set of existing (question_id, judge_id) pairs for fast lookup
  const existingPairs = new Set(
    (existingEvaluations || []).map((e) => `${e.question_id}:${e.judge_id}`)
  )

  // Build task list: for each question, find assigned judges
  const tasks: EvaluationTask[] = []
  let skippedCount = 0

  for (const question of questions || []) {
    // Find judges assigned to this question's template
    const assignedJudges = (assignments || [])
      .filter((a) => a.question_template_id === question.template_id)
      .map((a) => a.judges)
      .filter(Boolean)

    // Get the answer for this question
    const answer = question.answers?.[0] || {}

    for (const judge of assignedJudges) {
      // Validate judge data at runtime
      const validatedJudge = validateJudge(judge)
      if (!validatedJudge) {
        console.warn('Invalid judge data, skipping:', judge)
        continue
      }

      // Check if this (question, judge) pair already has an evaluation
      const pairKey = `${question.id}:${validatedJudge.id}`
      if (existingPairs.has(pairKey)) {
        skippedCount++
        continue
      }

      tasks.push({
        questionId: question.id,
        questionText: question.question_text || '',
        questionType: question.question_type || '',
        submissionId: question.submission_id,
        answer: {
          choice: answer.choice,
          reasoning: answer.reasoning,
          ...((answer.raw_value as Record<string, unknown>) || {}),
        },
        judge: validatedJudge,
      })
    }
  }

  return { tasks, skippedCount }
}

export async function runEvaluation(
  task: EvaluationTask
): Promise<{ success: boolean; result?: EvaluationResponse; error?: string }> {
  try {
    // Fetch any attachments for this question
    const attachments: Attachment[] = await getAttachmentsForQuestion(task.questionId)

    const result = await evaluate(task.judge.model_provider, task.judge.model_name, {
      systemPrompt: task.judge.system_prompt,
      questionText: task.questionText,
      questionType: task.questionType,
      answer: task.answer,
      attachments,
      promptFields: task.judge.prompt_fields,
    })

    // Save to database
    const { error: insertError } = await supabase.from('evaluations').insert({
      question_id: task.questionId,
      judge_id: task.judge.id,
      verdict: result.verdict,
      reasoning: result.reasoning,
      raw_response: result,
    })

    if (insertError) {
      throw new Error(`Failed to save evaluation: ${insertError.message}`)
    }

    return { success: true, result }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Save failed evaluation with error
    await supabase.from('evaluations').insert({
      question_id: task.questionId,
      judge_id: task.judge.id,
      verdict: 'inconclusive',
      reasoning: `Error: ${errorMessage}`,
      error_message: errorMessage,
    })

    return { success: false, error: errorMessage }
  }
}

export async function runAllEvaluations(
  queueId: string,
  onProgress: (progress: RunProgress) => void
): Promise<RunResult> {
  const { tasks, skippedCount } = await getEvaluationTasksWithSkipped(queueId)

  const result: RunResult = {
    total: tasks.length,
    completed: 0,
    failed: 0,
    skipped: skippedCount,
    errors: [],
  }

  onProgress({
    total: tasks.length,
    completed: 0,
    failed: 0,
    skipped: skippedCount,
  })

  // Run evaluations sequentially to avoid rate limits
  for (const task of tasks) {
    onProgress({
      total: tasks.length,
      completed: result.completed,
      failed: result.failed,
      skipped: skippedCount,
      current: `${task.judge.name}: ${task.questionText.slice(0, 50)}...`,
    })

    const evalResult = await runEvaluation(task)

    if (evalResult.success) {
      result.completed++
    } else {
      result.failed++
      if (evalResult.error) {
        result.errors.push(`${task.judge.name}: ${evalResult.error}`)
      }
    }

    onProgress({
      total: tasks.length,
      completed: result.completed,
      failed: result.failed,
      skipped: skippedCount,
    })

    // Small delay between requests to be nice to APIs
    await new Promise((resolve) => setTimeout(resolve, 200))
  }

  return result
}
