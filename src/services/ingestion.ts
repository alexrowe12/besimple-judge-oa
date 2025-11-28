import { supabase } from '@/lib/supabase'
import { validateSubmissionInput } from '@/lib/types'

export interface IngestionResult {
  success: boolean
  queuesCount: number
  submissionsCount: number
  questionsCount: number
  answersCount: number
  error?: string
  validationErrors?: string[]
}

// Maximum file size in bytes (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024

// Batch size for database operations to avoid payload limits
const BATCH_SIZE = 500

// Helper to batch insert data
async function batchInsert<T extends Record<string, unknown>>(
  table: string,
  data: T[]
): Promise<{ error: Error | null }> {
  if (data.length === 0) {
    return { error: null }
  }

  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from(table).insert(batch)
    if (error) {
      return { error: new Error(`${error.message} (batch ${Math.floor(i / BATCH_SIZE) + 1})`) }
    }
  }

  return { error: null }
}

// Helper to batch upsert data
async function batchUpsert<T extends Record<string, unknown>>(
  table: string,
  data: T[],
  onConflict: string
): Promise<{ error: Error | null }> {
  if (data.length === 0) {
    return { error: null }
  }

  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from(table).upsert(batch, { onConflict })
    if (error) {
      return { error: new Error(`${error.message} (batch ${Math.floor(i / BATCH_SIZE) + 1})`) }
    }
  }

  return { error: null }
}

export async function ingestSubmissions(file: File): Promise<IngestionResult> {
  try {
    // Check file size before reading
    if (file.size > MAX_FILE_SIZE) {
      return {
        success: false,
        queuesCount: 0,
        submissionsCount: 0,
        questionsCount: 0,
        answersCount: 0,
        error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum allowed is 10MB.`,
      }
    }

    // Parse JSON file
    const text = await file.text()

    let data: unknown
    try {
      data = JSON.parse(text)
    } catch (parseError) {
      return {
        success: false,
        queuesCount: 0,
        submissionsCount: 0,
        questionsCount: 0,
        answersCount: 0,
        error: `Invalid JSON: ${parseError instanceof Error ? parseError.message : 'Parse error'}`,
      }
    }

    // Validate structure with comprehensive checks
    const validation = validateSubmissionInput(data)

    if (!validation.valid || !validation.data) {
      // Limit the number of errors shown to avoid overwhelming the user
      const maxErrors = 10
      const displayErrors = validation.errors.slice(0, maxErrors)
      const hasMore = validation.errors.length > maxErrors

      return {
        success: false,
        queuesCount: 0,
        submissionsCount: 0,
        questionsCount: 0,
        answersCount: 0,
        error: `Validation failed with ${validation.errors.length} error(s)`,
        validationErrors: hasMore
          ? [...displayErrors, `... and ${validation.errors.length - maxErrors} more errors`]
          : displayErrors,
      }
    }

    const submissions = validation.data

    // Extract unique queues
    const uniqueQueues = [...new Set(submissions.map((s) => s.queueId))]

    // 1. Upsert queues (with batching)
    const queuesData = uniqueQueues.map((queueId) => ({
      id: queueId,
      name: queueId,
    }))

    const { error: queuesError } = await batchUpsert('queues', queuesData, 'id')

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

    // 2. Upsert submissions (with batching)
    const submissionsData = submissions.map((s) => ({
      id: s.id,
      queue_id: s.queueId,
      labeling_task_id: s.labelingTaskId,
      original_created_at: s.createdAt,
    }))

    const { error: submissionsError } = await batchUpsert('submissions', submissionsData, 'id')

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

    // 3. Handle questions - delete old questions for re-uploaded submissions first
    // This prevents orphaned questions when submission structure changes
    const submissionIds = submissions.map((s) => s.id)

    // First, get existing question IDs for these submissions to clean up related data
    // Only query if we have submission IDs to avoid empty .in() issues
    let existingQuestionIds: string[] = []
    if (submissionIds.length > 0) {
      const { data: existingQuestions, error: fetchError } = await supabase
        .from('questions')
        .select('id')
        .in('submission_id', submissionIds)

      if (fetchError) {
        return {
          success: false,
          queuesCount: uniqueQueues.length,
          submissionsCount: submissions.length,
          questionsCount: 0,
          answersCount: 0,
          error: `Failed to fetch existing questions: ${fetchError.message}`,
        }
      }

      existingQuestionIds = (existingQuestions || []).map((q) => q.id)
    }

    // Delete related data for existing questions (with proper error handling)
    if (existingQuestionIds.length > 0) {
      const { error: answersDelError } = await supabase
        .from('answers')
        .delete()
        .in('question_id', existingQuestionIds)
      if (answersDelError) {
        return {
          success: false,
          queuesCount: uniqueQueues.length,
          submissionsCount: submissions.length,
          questionsCount: 0,
          answersCount: 0,
          error: `Failed to delete old answers: ${answersDelError.message}`,
        }
      }

      const { error: evalsDelError } = await supabase
        .from('evaluations')
        .delete()
        .in('question_id', existingQuestionIds)
      if (evalsDelError) {
        return {
          success: false,
          queuesCount: uniqueQueues.length,
          submissionsCount: submissions.length,
          questionsCount: 0,
          answersCount: 0,
          error: `Failed to delete old evaluations: ${evalsDelError.message}`,
        }
      }

      const { error: attachDelError } = await supabase
        .from('attachments')
        .delete()
        .in('question_id', existingQuestionIds)
      if (attachDelError) {
        return {
          success: false,
          queuesCount: uniqueQueues.length,
          submissionsCount: submissions.length,
          questionsCount: 0,
          answersCount: 0,
          error: `Failed to delete old attachments: ${attachDelError.message}`,
        }
      }
    }

    // Delete old questions for these submissions
    if (submissionIds.length > 0) {
      const { error: questionsDelError } = await supabase
        .from('questions')
        .delete()
        .in('submission_id', submissionIds)
      if (questionsDelError) {
        return {
          success: false,
          queuesCount: uniqueQueues.length,
          submissionsCount: submissions.length,
          questionsCount: 0,
          answersCount: 0,
          error: `Failed to delete old questions: ${questionsDelError.message}`,
        }
      }
    }

    // Now insert new questions (with batching)
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

    const { error: questionsError } = await batchInsert('questions', questionsData)

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

    // 4. Insert answers for new questions (with batching)
    const answersData = submissions.flatMap((s) =>
      Object.entries(s.answers).map(([templateId, answer]) => ({
        question_id: `${s.id}_${templateId}`,
        choice: answer.choice ?? null,
        reasoning: answer.reasoning ?? null,
        raw_value: answer as Record<string, unknown>,
      }))
    )

    const { error: answersError } = await batchInsert('answers', answersData)

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
