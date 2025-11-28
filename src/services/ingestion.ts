import { supabase } from '@/lib/supabase'
import type { SubmissionInput } from '@/lib/types'
import { validateSubmissionInput } from '@/lib/types'

export interface IngestionResult {
  success: boolean
  queuesCount: number
  submissionsCount: number
  questionsCount: number
  answersCount: number
  error?: string
}

export async function ingestSubmissions(file: File): Promise<IngestionResult> {
  try {
    // Parse JSON file
    const text = await file.text()
    const data = JSON.parse(text)

    // Validate structure
    if (!validateSubmissionInput(data)) {
      return {
        success: false,
        queuesCount: 0,
        submissionsCount: 0,
        questionsCount: 0,
        answersCount: 0,
        error: 'Invalid JSON structure. Expected array of submissions.',
      }
    }

    const submissions = data as SubmissionInput[]

    // Extract unique queues
    const uniqueQueues = [...new Set(submissions.map((s) => s.queueId))]

    // 1. Upsert queues
    const queuesData = uniqueQueues.map((queueId) => ({
      id: queueId,
      name: queueId,
    }))

    const { error: queuesError } = await supabase
      .from('queues')
      .upsert(queuesData, { onConflict: 'id' })

    if (queuesError) {
      return {
        success: false,
        queuesCount: 0,
        submissionsCount: 0,
        questionsCount: 0,
        answersCount: 0,
        error: `Failed to insert queues: ${queuesError.message}`,
      }
    }

    // 2. Upsert submissions
    const submissionsData = submissions.map((s) => ({
      id: s.id,
      queue_id: s.queueId,
      labeling_task_id: s.labelingTaskId,
      original_created_at: s.createdAt,
    }))

    const { error: submissionsError } = await supabase
      .from('submissions')
      .upsert(submissionsData, { onConflict: 'id' })

    if (submissionsError) {
      return {
        success: false,
        queuesCount: uniqueQueues.length,
        submissionsCount: 0,
        questionsCount: 0,
        answersCount: 0,
        error: `Failed to insert submissions: ${submissionsError.message}`,
      }
    }

    // 3. Upsert questions
    const questionsData = submissions.flatMap((s) =>
      s.questions.map((q) => ({
        id: `${s.id}_${q.data.id}`,
        submission_id: s.id,
        template_id: q.data.id,
        question_type: q.data.questionType,
        question_text: q.data.questionText,
        rev: q.rev,
      }))
    )

    const { error: questionsError } = await supabase
      .from('questions')
      .upsert(questionsData, { onConflict: 'id' })

    if (questionsError) {
      return {
        success: false,
        queuesCount: uniqueQueues.length,
        submissionsCount: submissions.length,
        questionsCount: 0,
        answersCount: 0,
        error: `Failed to insert questions: ${questionsError.message}`,
      }
    }

    // 4. Insert answers (delete existing first for re-uploads)
    const answersData = submissions.flatMap((s) =>
      Object.entries(s.answers).map(([templateId, answer]) => ({
        question_id: `${s.id}_${templateId}`,
        choice: answer.choice ?? null,
        reasoning: answer.reasoning ?? null,
        raw_value: answer as Record<string, unknown>,
      }))
    )

    // Delete existing answers for these questions
    const questionIds = answersData.map((a) => a.question_id)
    await supabase.from('answers').delete().in('question_id', questionIds)

    const { error: answersError } = await supabase
      .from('answers')
      .insert(answersData)

    if (answersError) {
      return {
        success: false,
        queuesCount: uniqueQueues.length,
        submissionsCount: submissions.length,
        questionsCount: questionsData.length,
        answersCount: 0,
        error: `Failed to insert answers: ${answersError.message}`,
      }
    }

    return {
      success: true,
      queuesCount: uniqueQueues.length,
      submissionsCount: submissions.length,
      questionsCount: questionsData.length,
      answersCount: answersData.length,
    }
  } catch (err) {
    return {
      success: false,
      queuesCount: 0,
      submissionsCount: 0,
      questionsCount: 0,
      answersCount: 0,
      error: err instanceof Error ? err.message : 'Unknown error occurred',
    }
  }
}
