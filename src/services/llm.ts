export interface Attachment {
  url: string
  type: 'image' | 'pdf'
  mimeType: string
}

export interface PromptFields {
  includeQuestionText: boolean
  includeQuestionType: boolean
  includeAnswerChoice: boolean
  includeAnswerReasoning: boolean
  includeRawAnswer: boolean
  includeAttachments: boolean
}

export interface EvaluationRequest {
  systemPrompt: string
  questionText: string
  questionType: string
  answer: {
    choice?: string
    reasoning?: string
    [key: string]: unknown
  }
  attachments?: Attachment[]
  promptFields?: PromptFields
}

export interface EvaluationResponse {
  verdict: 'pass' | 'fail' | 'inconclusive'
  reasoning: string
}

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY
const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY

// Request timeout in milliseconds (30 seconds)
const REQUEST_TIMEOUT = 30000

// Rate limiting configuration
const MAX_RETRIES = 3
const INITIAL_RETRY_DELAY = 1000 // 1 second

// Helper to create a fetch with timeout
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number = REQUEST_TIMEOUT
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

// Helper to check if error is retryable (rate limit or server error)
function isRetryableError(status: number): boolean {
  return status === 429 || status >= 500
}

// Helper to get retry delay with exponential backoff
function getRetryDelay(attempt: number, retryAfterHeader?: string | null): number {
  // Use Retry-After header if provided
  if (retryAfterHeader) {
    const retryAfter = parseInt(retryAfterHeader, 10)
    if (!isNaN(retryAfter)) {
      return retryAfter * 1000
    }
  }
  // Exponential backoff: 1s, 2s, 4s, etc.
  return INITIAL_RETRY_DELAY * Math.pow(2, attempt)
}

// Default prompt fields if not specified
const DEFAULT_PROMPT_FIELDS: PromptFields = {
  includeQuestionText: true,
  includeQuestionType: true,
  includeAnswerChoice: true,
  includeAnswerReasoning: true,
  includeRawAnswer: false,
  includeAttachments: true,
}

function buildPromptText(request: EvaluationRequest): string {
  const fields = request.promptFields || DEFAULT_PROMPT_FIELDS
  const parts: string[] = []

  // Question info
  if (fields.includeQuestionText) {
    parts.push(`Question: ${request.questionText}`)
  }
  if (fields.includeQuestionType) {
    parts.push(`Question Type: ${request.questionType}`)
  }

  // Attachments note
  if (fields.includeAttachments && request.attachments?.length) {
    parts.push(`\n[${request.attachments.length} attachment(s) included - please review the images above]`)
  }

  // Answer section
  const answerParts: string[] = []
  if (fields.includeAnswerChoice && request.answer.choice) {
    answerParts.push(`Choice: ${request.answer.choice}`)
  }
  if (fields.includeAnswerReasoning && request.answer.reasoning) {
    answerParts.push(`Reasoning: ${request.answer.reasoning}`)
  }

  // Get extra fields (excluding choice and reasoning which are handled above)
  const { choice: _choice, reasoning: _reasoning, ...extraFields } = request.answer
  const hasExtraFields = Object.keys(extraFields).length > 0

  if (fields.includeRawAnswer && hasExtraFields) {
    // Include extra fields when explicitly enabled
    answerParts.push(`Additional Data:\n${JSON.stringify(extraFields, null, 2)}`)
  } else if (answerParts.length === 0 && hasExtraFields) {
    // Fallback: if no standard fields were included but there IS answer data,
    // include the raw answer so the LLM has something to evaluate
    answerParts.push(`Answer:\n${JSON.stringify(extraFields, null, 2)}`)
  }

  if (answerParts.length > 0) {
    parts.push(`\nUser's Answer:\n${answerParts.join('\n')}`)
  } else if (Object.keys(request.answer).length === 0) {
    // Explicitly note when there's no answer at all
    parts.push(`\nUser's Answer: [No answer provided]`)
  }

  // Evaluation instruction
  parts.push(`\n---\n\nEvaluate this answer based on the criteria in your system prompt.
Respond with ONLY a valid JSON object in this exact format:
{"verdict": "pass" | "fail" | "inconclusive", "reasoning": "Brief explanation"}`)

  return parts.join('\n')
}

const VALID_VERDICTS = ['pass', 'fail', 'inconclusive'] as const

function extractJSON(text: string): string | null {
  // Try to find JSON object, handling nested braces
  // Look for opening brace and find matching closing brace
  const startIndex = text.indexOf('{')
  if (startIndex === -1) return null

  let braceCount = 0
  let inString = false
  let escapeNext = false

  for (let i = startIndex; i < text.length; i++) {
    const char = text[i]

    if (escapeNext) {
      escapeNext = false
      continue
    }

    if (char === '\\' && inString) {
      escapeNext = true
      continue
    }

    if (char === '"') {
      inString = !inString
      continue
    }

    if (!inString) {
      if (char === '{') braceCount++
      else if (char === '}') {
        braceCount--
        if (braceCount === 0) {
          return text.slice(startIndex, i + 1)
        }
      }
    }
  }

  return null
}

function parseResponse(text: string): EvaluationResponse {
  // Extract JSON from the response
  const jsonString = extractJSON(text)
  if (!jsonString) {
    throw new Error(`No JSON object found in response. Raw response: "${text.slice(0, 200)}..."`)
  }

  // Parse JSON with error handling
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonString)
  } catch (e) {
    throw new Error(`Invalid JSON in response: ${e instanceof Error ? e.message : 'Parse error'}. Extracted: "${jsonString.slice(0, 100)}..."`)
  }

  // Validate parsed is an object
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Expected JSON object, got ${Array.isArray(parsed) ? 'array' : typeof parsed}`)
  }

  const obj = parsed as Record<string, unknown>

  // Validate verdict field exists and is valid
  if (!('verdict' in obj)) {
    throw new Error('Response missing required "verdict" field')
  }

  const verdict = obj.verdict
  if (typeof verdict !== 'string') {
    throw new Error(`"verdict" must be a string, got ${typeof verdict}`)
  }

  const normalizedVerdict = verdict.toLowerCase().trim()
  if (!VALID_VERDICTS.includes(normalizedVerdict as typeof VALID_VERDICTS[number])) {
    throw new Error(`Invalid verdict "${verdict}". Must be one of: ${VALID_VERDICTS.join(', ')}`)
  }

  // Validate reasoning field (optional but should be string if present)
  let reasoning = 'No reasoning provided'
  if ('reasoning' in obj && obj.reasoning != null) {
    if (typeof obj.reasoning === 'string') {
      reasoning = obj.reasoning.trim() || 'No reasoning provided'
    } else {
      // Convert non-string reasoning to string representation
      reasoning = String(obj.reasoning)
    }
  }

  return {
    verdict: normalizedVerdict as 'pass' | 'fail' | 'inconclusive',
    reasoning,
  }
}

// Convert URL to base64 for API calls
async function urlToBase64(url: string): Promise<string> {
  const response = await fetch(url)
  const blob = await response.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result as string
      // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64Data = base64.split(',')[1]
      resolve(base64Data)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// Build OpenAI message content with images
// Note: OpenAI chat completions API doesn't support PDFs directly - use Anthropic for PDF support
async function buildOpenAIContent(request: EvaluationRequest): Promise<unknown> {
  const textContent = buildPromptText(request)
  const fields = request.promptFields || DEFAULT_PROMPT_FIELDS

  // Only include attachments if enabled
  if (!fields.includeAttachments || !request.attachments?.length) {
    return textContent
  }

  // Build multimodal content array
  const content: unknown[] = []

  // Track skipped PDFs
  const skippedPdfs: string[] = []

  // Add images (OpenAI doesn't support PDFs in chat completions)
  for (const attachment of request.attachments) {
    if (attachment.type === 'image') {
      try {
        const base64 = await urlToBase64(attachment.url)
        content.push({
          type: 'image_url',
          image_url: {
            url: `data:${attachment.mimeType};base64,${base64}`,
          },
        })
      } catch (e) {
        console.warn('Failed to load attachment:', e)
      }
    } else if (attachment.type === 'pdf') {
      skippedPdfs.push(attachment.url)
    }
  }

  // Add note about skipped PDFs
  let finalText = textContent
  if (skippedPdfs.length > 0) {
    finalText += `\n\n[Note: ${skippedPdfs.length} PDF attachment(s) could not be included - OpenAI doesn't support PDFs in chat. Consider using Anthropic for PDF evaluation.]`
  }

  // Add text
  content.push({
    type: 'text',
    text: finalText,
  })

  return content
}

// Build Anthropic message content with images and PDFs
async function buildAnthropicContent(request: EvaluationRequest): Promise<unknown> {
  const textContent = buildPromptText(request)
  const fields = request.promptFields || DEFAULT_PROMPT_FIELDS

  // Only include attachments if enabled
  if (!fields.includeAttachments || !request.attachments?.length) {
    return textContent
  }

  // Build multimodal content array
  const content: unknown[] = []

  // Add images and PDFs
  for (const attachment of request.attachments) {
    try {
      const base64 = await urlToBase64(attachment.url)

      if (attachment.type === 'image') {
        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: attachment.mimeType,
            data: base64,
          },
        })
      } else if (attachment.type === 'pdf') {
        // Anthropic supports PDFs via the document type
        content.push({
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: base64,
          },
        })
      }
    } catch (e) {
      console.warn('Failed to load attachment:', e)
    }
  }

  // Add text
  content.push({
    type: 'text',
    text: textContent,
  })

  return content
}

export async function callOpenAI(
  model: string,
  request: EvaluationRequest
): Promise<EvaluationResponse> {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured')
  }

  const userContent = await buildOpenAIContent(request)

  // Build request body - newer models use max_completion_tokens instead of max_tokens
  // and don't support temperature parameter
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: request.systemPrompt },
      { role: 'user', content: userContent },
    ],
    max_completion_tokens: 2048,
  }

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetchWithTimeout(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify(body),
        }
      )

      if (!response.ok) {
        // Check if we should retry
        if (isRetryableError(response.status) && attempt < MAX_RETRIES) {
          const delay = getRetryDelay(attempt, response.headers.get('Retry-After'))
          console.warn(`OpenAI rate limited (${response.status}), retrying in ${delay}ms...`)
          await new Promise((resolve) => setTimeout(resolve, delay))
          continue
        }

        const error = await response.json().catch(() => ({}))
        throw new Error(
          error.error?.message || `OpenAI API error: ${response.status}`
        )
      }

      const data = await response.json()

      // Check for various response issues
      if (data.error) {
        throw new Error(data.error.message || 'OpenAI API returned an error')
      }

      const choice = data.choices?.[0]

      // Check for refusal
      if (choice?.message?.refusal) {
        throw new Error(`Model refused: ${choice.message.refusal}`)
      }

      // Check finish reason
      if (choice?.finish_reason === 'content_filter') {
        throw new Error('Response blocked by content filter')
      }

      const content = choice?.message?.content

      if (!content) {
        // Provide more detail about what we received
        const debugInfo = JSON.stringify({
          hasChoices: !!data.choices,
          choicesLength: data.choices?.length,
          finishReason: choice?.finish_reason,
          hasMessage: !!choice?.message,
        })
        throw new Error(`No content in OpenAI response. Debug: ${debugInfo}`)
      }

      return parseResponse(content)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Handle timeout specifically
      if (lastError.name === 'AbortError') {
        lastError = new Error('Request timed out after 30 seconds')
      }

      // Only retry on network errors if we have retries left
      if (attempt < MAX_RETRIES && lastError.message.includes('fetch')) {
        const delay = getRetryDelay(attempt)
        console.warn(`OpenAI network error, retrying in ${delay}ms...`)
        await new Promise((resolve) => setTimeout(resolve, delay))
        continue
      }

      throw lastError
    }
  }

  throw lastError || new Error('OpenAI request failed after retries')
}

export async function callAnthropic(
  model: string,
  request: EvaluationRequest
): Promise<EvaluationResponse> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('Anthropic API key not configured')
  }

  const userContent = await buildAnthropicContent(request)

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetchWithTimeout(
        'https://api.anthropic.com/v1/messages',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model,
            max_tokens: 1024,
            system: request.systemPrompt,
            messages: [{ role: 'user', content: userContent }],
          }),
        }
      )

      if (!response.ok) {
        // Check if we should retry
        if (isRetryableError(response.status) && attempt < MAX_RETRIES) {
          const delay = getRetryDelay(attempt, response.headers.get('Retry-After'))
          console.warn(`Anthropic rate limited (${response.status}), retrying in ${delay}ms...`)
          await new Promise((resolve) => setTimeout(resolve, delay))
          continue
        }

        const error = await response.json().catch(() => ({}))
        throw new Error(
          error.error?.message || `Anthropic API error: ${response.status}`
        )
      }

      const data = await response.json()
      const content = data.content?.[0]?.text

      if (!content) {
        throw new Error('No content in Anthropic response')
      }

      return parseResponse(content)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Handle timeout specifically
      if (lastError.name === 'AbortError') {
        lastError = new Error('Request timed out after 30 seconds')
      }

      // Only retry on network errors if we have retries left
      if (attempt < MAX_RETRIES && lastError.message.includes('fetch')) {
        const delay = getRetryDelay(attempt)
        console.warn(`Anthropic network error, retrying in ${delay}ms...`)
        await new Promise((resolve) => setTimeout(resolve, delay))
        continue
      }

      throw lastError
    }
  }

  throw lastError || new Error('Anthropic request failed after retries')
}

export async function evaluate(
  provider: 'openai' | 'anthropic',
  model: string,
  request: EvaluationRequest
): Promise<EvaluationResponse> {
  if (provider === 'openai') {
    return callOpenAI(model, request)
  } else {
    return callAnthropic(model, request)
  }
}
