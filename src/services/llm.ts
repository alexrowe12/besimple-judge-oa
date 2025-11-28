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
  if (fields.includeRawAnswer) {
    // Include any extra fields from raw_value
    const { choice, reasoning, ...extraFields } = request.answer
    if (Object.keys(extraFields).length > 0) {
      answerParts.push(`Additional Data:\n${JSON.stringify(extraFields, null, 2)}`)
    }
  }

  if (answerParts.length > 0) {
    parts.push(`\nUser's Answer:\n${answerParts.join('\n')}`)
  }

  // Evaluation instruction
  parts.push(`\n---\n\nEvaluate this answer based on the criteria in your system prompt.
Respond with ONLY a valid JSON object in this exact format:
{"verdict": "pass" | "fail" | "inconclusive", "reasoning": "Brief explanation"}`)

  return parts.join('\n')
}

function parseResponse(text: string): EvaluationResponse {
  // Try to extract JSON from the response
  const jsonMatch = text.match(/\{[\s\S]*?\}/)
  if (!jsonMatch) {
    throw new Error('No JSON found in response')
  }

  const parsed = JSON.parse(jsonMatch[0])

  if (!['pass', 'fail', 'inconclusive'].includes(parsed.verdict)) {
    throw new Error(`Invalid verdict: ${parsed.verdict}`)
  }

  return {
    verdict: parsed.verdict,
    reasoning: parsed.reasoning || 'No reasoning provided',
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

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
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
}

export async function callAnthropic(
  model: string,
  request: EvaluationRequest
): Promise<EvaluationResponse> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('Anthropic API key not configured')
  }

  const userContent = await buildAnthropicContent(request)

  const response = await fetch('https://api.anthropic.com/v1/messages', {
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
  })

  if (!response.ok) {
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
