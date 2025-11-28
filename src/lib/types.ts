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

// Validation result with detailed errors
export interface ValidationResult {
  valid: boolean
  errors: string[]
  data: SubmissionInput[] | null
}

// Helper type guards
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value)
}

// Validate a single question
function validateQuestion(question: unknown, index: number, submissionId: string): string[] {
  const errors: string[] = []
  const prefix = `Submission "${submissionId}" question[${index}]`

  if (!isObject(question)) {
    errors.push(`${prefix}: must be an object`)
    return errors
  }

  // Validate rev
  if (!('rev' in question)) {
    errors.push(`${prefix}: missing "rev" field`)
  } else if (!isNumber(question.rev)) {
    errors.push(`${prefix}: "rev" must be a number, got ${typeof question.rev}`)
  }

  // Validate data object
  if (!('data' in question)) {
    errors.push(`${prefix}: missing "data" field`)
    return errors
  }

  if (!isObject(question.data)) {
    errors.push(`${prefix}: "data" must be an object`)
    return errors
  }

  const data = question.data

  // Validate data.id
  if (!('id' in data)) {
    errors.push(`${prefix}.data: missing "id" field`)
  } else if (!isString(data.id)) {
    errors.push(`${prefix}.data: "id" must be a string`)
  } else if (data.id.trim() === '') {
    errors.push(`${prefix}.data: "id" cannot be empty`)
  }

  // Validate data.questionType
  if (!('questionType' in data)) {
    errors.push(`${prefix}.data: missing "questionType" field`)
  } else if (!isString(data.questionType)) {
    errors.push(`${prefix}.data: "questionType" must be a string`)
  }

  // Validate data.questionText
  if (!('questionText' in data)) {
    errors.push(`${prefix}.data: missing "questionText" field`)
  } else if (!isString(data.questionText)) {
    errors.push(`${prefix}.data: "questionText" must be a string`)
  }

  return errors
}

// Validate answers object
function validateAnswers(
  answers: unknown,
  questionIds: string[],
  submissionId: string
): string[] {
  const errors: string[] = []
  const prefix = `Submission "${submissionId}" answers`

  if (!isObject(answers)) {
    errors.push(`${prefix}: must be an object`)
    return errors
  }

  // Check that each answer key corresponds to a question
  const answerKeys = Object.keys(answers)
  for (const key of answerKeys) {
    if (!questionIds.includes(key)) {
      errors.push(`${prefix}: answer key "${key}" does not match any question id`)
    }

    // Validate each answer is an object
    const answer = answers[key]
    if (!isObject(answer)) {
      errors.push(`${prefix}["${key}"]: must be an object, got ${typeof answer}`)
    }
  }

  // Warn about missing answers (not an error, but logged)
  for (const qid of questionIds) {
    if (!answerKeys.includes(qid)) {
      // This is acceptable - questions can be unanswered
      // But we could add a warning if needed
    }
  }

  return errors
}

// Validate a single submission
function validateSubmission(submission: unknown, index: number): string[] {
  const errors: string[] = []
  const prefix = `Submission[${index}]`

  if (!isObject(submission)) {
    errors.push(`${prefix}: must be an object`)
    return errors
  }

  // Get id early for better error messages
  const submissionId = isString(submission.id) ? submission.id : `index_${index}`

  // Validate id
  if (!('id' in submission)) {
    errors.push(`${prefix}: missing "id" field`)
  } else if (!isString(submission.id)) {
    errors.push(`${prefix}: "id" must be a string, got ${typeof submission.id}`)
  } else if (submission.id.trim() === '') {
    errors.push(`${prefix}: "id" cannot be empty`)
  }

  // Validate queueId
  if (!('queueId' in submission)) {
    errors.push(`Submission "${submissionId}": missing "queueId" field`)
  } else if (!isString(submission.queueId)) {
    errors.push(`Submission "${submissionId}": "queueId" must be a string`)
  } else if (submission.queueId.trim() === '') {
    errors.push(`Submission "${submissionId}": "queueId" cannot be empty`)
  }

  // Validate labelingTaskId
  if (!('labelingTaskId' in submission)) {
    errors.push(`Submission "${submissionId}": missing "labelingTaskId" field`)
  } else if (!isString(submission.labelingTaskId)) {
    errors.push(`Submission "${submissionId}": "labelingTaskId" must be a string`)
  }

  // Validate createdAt
  if (!('createdAt' in submission)) {
    errors.push(`Submission "${submissionId}": missing "createdAt" field`)
  } else if (!isNumber(submission.createdAt)) {
    errors.push(`Submission "${submissionId}": "createdAt" must be a number (timestamp), got ${typeof submission.createdAt}`)
  } else if (submission.createdAt < 0) {
    errors.push(`Submission "${submissionId}": "createdAt" must be a positive timestamp`)
  }

  // Validate questions array
  if (!('questions' in submission)) {
    errors.push(`Submission "${submissionId}": missing "questions" field`)
  } else if (!Array.isArray(submission.questions)) {
    errors.push(`Submission "${submissionId}": "questions" must be an array`)
  } else if (submission.questions.length === 0) {
    errors.push(`Submission "${submissionId}": "questions" array cannot be empty`)
  } else {
    // Validate each question
    const questionIds: string[] = []
    submission.questions.forEach((q: unknown, i: number) => {
      const questionErrors = validateQuestion(q, i, submissionId)
      errors.push(...questionErrors)

      // Collect question ids for answer validation
      if (isObject(q) && isObject(q.data) && isString(q.data.id)) {
        questionIds.push(q.data.id)
      }
    })

    // Check for duplicate question ids
    const uniqueIds = new Set(questionIds)
    if (uniqueIds.size !== questionIds.length) {
      const duplicates = questionIds.filter((id, i) => questionIds.indexOf(id) !== i)
      errors.push(`Submission "${submissionId}": duplicate question ids found: ${[...new Set(duplicates)].join(', ')}`)
    }

    // Validate answers if questions are valid
    if ('answers' in submission) {
      const answerErrors = validateAnswers(submission.answers, questionIds, submissionId)
      errors.push(...answerErrors)
    } else {
      errors.push(`Submission "${submissionId}": missing "answers" field`)
    }
  }

  return errors
}

/**
 * Validates submission input data with comprehensive checks.
 * Returns detailed error messages for each validation failure.
 */
export function validateSubmissionInput(data: unknown): ValidationResult {
  const errors: string[] = []

  // Check if data is an array
  if (!Array.isArray(data)) {
    return {
      valid: false,
      errors: ['Input must be an array of submissions'],
      data: null,
    }
  }

  // Check if array is empty
  if (data.length === 0) {
    return {
      valid: false,
      errors: ['Input array cannot be empty'],
      data: null,
    }
  }

  // Check for reasonable size limit (prevent memory issues)
  const MAX_SUBMISSIONS = 10000
  if (data.length > MAX_SUBMISSIONS) {
    return {
      valid: false,
      errors: [`Too many submissions: ${data.length}. Maximum allowed is ${MAX_SUBMISSIONS}`],
      data: null,
    }
  }

  // Validate each submission
  data.forEach((submission, index) => {
    const submissionErrors = validateSubmission(submission, index)
    errors.push(...submissionErrors)
  })

  // Check for duplicate submission ids
  const ids = data
    .filter((s): s is Record<string, unknown> => isObject(s))
    .map((s) => s.id)
    .filter(isString)

  const uniqueIds = new Set(ids)
  if (uniqueIds.size !== ids.length) {
    const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i)
    errors.push(`Duplicate submission ids found: ${[...new Set(duplicates)].join(', ')}`)
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
      data: null,
    }
  }

  // Data is valid - cast is now safe after thorough validation
  return {
    valid: true,
    errors: [],
    data: data as SubmissionInput[],
  }
}

/**
 * Legacy type guard for backward compatibility.
 * Prefer validateSubmissionInput() for detailed error messages.
 */
export function isValidSubmissionInput(data: unknown): data is SubmissionInput[] {
  return validateSubmissionInput(data).valid
}
