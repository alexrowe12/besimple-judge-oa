// Types for the JSON input format
export interface SubmissionInput {
  id: string
  queueId: string
  labelingTaskId: string
  createdAt: number
  questions: QuestionInput[]
  answers: Record<string, AnswerInput>
}

export interface QuestionInput {
  rev: number
  data: {
    id: string
    questionType: string
    questionText: string
  }
}

export interface AnswerInput {
  choice?: string
  reasoning?: string
  [key: string]: unknown // Allow for other answer types
}

// Validation function
export function validateSubmissionInput(data: unknown): data is SubmissionInput[] {
  if (!Array.isArray(data)) return false

  for (const item of data) {
    if (typeof item !== 'object' || item === null) return false
    if (typeof item.id !== 'string') return false
    if (typeof item.queueId !== 'string') return false
    if (!Array.isArray(item.questions)) return false
    if (typeof item.answers !== 'object') return false
  }

  return true
}
