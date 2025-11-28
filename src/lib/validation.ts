/**
 * Runtime validation utilities for API responses
 * These type guards ensure data from Supabase matches expected shapes
 */

// Generic helpers
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isString(value: unknown): value is string {
  return typeof value === 'string'
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number'
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

// Evaluation validation
export interface ValidatedEvaluation {
  id: string
  verdict: 'pass' | 'fail' | 'inconclusive'
  reasoning: string
  created_at: string
  question_id: string
  judge_id: string
  questions: {
    id: string
    question_text: string
    submission_id: string
  } | null
  judges: {
    id: string
    name: string
  } | null
}

export function validateEvaluation(data: unknown): ValidatedEvaluation | null {
  if (!isObject(data)) return null

  // Required fields
  if (!isString(data.id)) return null
  if (!isString(data.verdict)) return null
  if (!isString(data.created_at)) return null
  if (!isString(data.question_id)) return null
  if (!isString(data.judge_id)) return null

  // Validate verdict value
  const validVerdicts = ['pass', 'fail', 'inconclusive']
  if (!validVerdicts.includes(data.verdict)) return null

  // Optional/nullable fields
  const reasoning = isString(data.reasoning) ? data.reasoning : ''

  // Nested questions object
  let questions: ValidatedEvaluation['questions'] = null
  if (isObject(data.questions)) {
    if (isString(data.questions.id) && isString(data.questions.submission_id)) {
      questions = {
        id: data.questions.id,
        question_text: isString(data.questions.question_text) ? data.questions.question_text : '',
        submission_id: data.questions.submission_id,
      }
    }
  }

  // Nested judges object
  let judges: ValidatedEvaluation['judges'] = null
  if (isObject(data.judges)) {
    if (isString(data.judges.id) && isString(data.judges.name)) {
      judges = {
        id: data.judges.id,
        name: data.judges.name,
      }
    }
  }

  return {
    id: data.id,
    verdict: data.verdict as 'pass' | 'fail' | 'inconclusive',
    reasoning,
    created_at: data.created_at,
    question_id: data.question_id,
    judge_id: data.judge_id,
    questions,
    judges,
  }
}

export function validateEvaluations(data: unknown): ValidatedEvaluation[] {
  if (!Array.isArray(data)) return []
  return data.map(validateEvaluation).filter((e): e is ValidatedEvaluation => e !== null)
}

// Queue validation
export interface ValidatedQueue {
  id: string
  name: string | null
  created_at: string
  submissions: { count: number }[]
}

export function validateQueue(data: unknown): ValidatedQueue | null {
  if (!isObject(data)) return null

  if (!isString(data.id)) return null
  if (!isString(data.created_at)) return null

  const name = isString(data.name) ? data.name : null

  // Handle submissions count - Supabase returns array with count
  let submissions: { count: number }[] = []
  if (Array.isArray(data.submissions)) {
    submissions = data.submissions
      .filter(isObject)
      .map((s) => ({ count: isNumber(s.count) ? s.count : 0 }))
  }

  return {
    id: data.id,
    name,
    created_at: data.created_at,
    submissions,
  }
}

export function validateQueues(data: unknown): ValidatedQueue[] {
  if (!Array.isArray(data)) return []
  return data.map(validateQueue).filter((q): q is ValidatedQueue => q !== null)
}

// Judge validation for evaluation runner
export interface ValidatedJudge {
  id: string
  name: string
  system_prompt: string
  model_provider: 'openai' | 'anthropic'
  model_name: string
  prompt_fields?: {
    includeQuestionText: boolean
    includeQuestionType: boolean
    includeAnswerChoice: boolean
    includeAnswerReasoning: boolean
    includeRawAnswer: boolean
    includeAttachments: boolean
  }
}

export function validateJudge(data: unknown): ValidatedJudge | null {
  if (!isObject(data)) return null

  if (!isString(data.id)) return null
  if (!isString(data.name)) return null
  if (!isString(data.system_prompt)) return null
  if (!isString(data.model_provider)) return null
  if (!isString(data.model_name)) return null

  // Validate model_provider is one of the expected values
  const validProviders = ['openai', 'anthropic']
  if (!validProviders.includes(data.model_provider)) return null

  // Validate prompt_fields if present
  let prompt_fields: ValidatedJudge['prompt_fields'] = undefined
  if (isObject(data.prompt_fields)) {
    const pf = data.prompt_fields
    prompt_fields = {
      includeQuestionText: isBoolean(pf.includeQuestionText) ? pf.includeQuestionText : true,
      includeQuestionType: isBoolean(pf.includeQuestionType) ? pf.includeQuestionType : true,
      includeAnswerChoice: isBoolean(pf.includeAnswerChoice) ? pf.includeAnswerChoice : true,
      includeAnswerReasoning: isBoolean(pf.includeAnswerReasoning) ? pf.includeAnswerReasoning : true,
      includeRawAnswer: isBoolean(pf.includeRawAnswer) ? pf.includeRawAnswer : false,
      includeAttachments: isBoolean(pf.includeAttachments) ? pf.includeAttachments : true,
    }
  }

  return {
    id: data.id,
    name: data.name,
    system_prompt: data.system_prompt,
    model_provider: data.model_provider as 'openai' | 'anthropic',
    model_name: data.model_name,
    prompt_fields,
  }
}
