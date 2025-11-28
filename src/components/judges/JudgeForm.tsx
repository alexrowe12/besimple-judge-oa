import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'

export interface PromptFields {
  includeQuestionText: boolean
  includeQuestionType: boolean
  includeAnswerChoice: boolean
  includeAnswerReasoning: boolean
  includeRawAnswer: boolean
  includeAttachments: boolean
}

export interface JudgeFormData {
  name: string
  system_prompt: string
  model_provider: 'openai' | 'anthropic'
  model_name: string
  active: boolean
  prompt_fields: PromptFields
}

interface Judge {
  id: string
  name: string
  system_prompt: string
  model_provider: 'openai' | 'anthropic'
  model_name: string
  active: boolean
  prompt_fields?: PromptFields | null
  created_at: string
  updated_at: string
}

interface JudgeFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: JudgeFormData) => Promise<void>
  judge?: Judge | null
  isLoading?: boolean
}

const MODEL_OPTIONS = {
  openai: [
    { value: 'gpt-5-nano', label: 'GPT-5 Nano (Fastest & Cheapest)' },
    { value: 'gpt-5-mini', label: 'GPT-5 Mini (Fast)' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-4o', label: 'GPT-4o' },
  ],
  anthropic: [
    { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4 (Recommended)' },
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku (Fast)' },
  ],
}

const DEFAULT_PROMPT = `You are an AI judge evaluating the quality of answers to questions.

Evaluate the answer based on:
1. Correctness - Is the answer factually correct?
2. Reasoning - Is the reasoning sound and well-explained?
3. Completeness - Does it fully address the question?

Respond with a JSON object:
{
  "verdict": "pass" | "fail" | "inconclusive",
  "reasoning": "Brief explanation of your evaluation"
}`

const DEFAULT_PROMPT_FIELDS: PromptFields = {
  includeQuestionText: true,
  includeQuestionType: true,
  includeAnswerChoice: true,
  includeAnswerReasoning: true,
  includeRawAnswer: false,
  includeAttachments: true,
}

const PROMPT_FIELD_OPTIONS = [
  { key: 'includeQuestionText', label: 'Question Text', description: 'The full question being evaluated' },
  { key: 'includeQuestionType', label: 'Question Type', description: 'Type category (e.g., multiple_choice, free_text)' },
  { key: 'includeAnswerChoice', label: 'Answer Choice', description: 'The selected answer option' },
  { key: 'includeAnswerReasoning', label: 'Answer Reasoning', description: 'Explanation provided with the answer' },
  { key: 'includeRawAnswer', label: 'Raw Answer Data', description: 'Full JSON of additional answer fields' },
  { key: 'includeAttachments', label: 'Attachments', description: 'Images or files attached to the question' },
] as const

export function JudgeForm({
  open,
  onOpenChange,
  onSubmit,
  judge,
  isLoading,
}: JudgeFormProps) {
  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<JudgeFormData>({
    defaultValues: {
      name: '',
      system_prompt: DEFAULT_PROMPT,
      model_provider: 'openai',
      model_name: 'gpt-5-nano',
      active: true,
      prompt_fields: DEFAULT_PROMPT_FIELDS,
    },
  })

  const modelProvider = watch('model_provider')
  const promptFields = watch('prompt_fields')

  // Reset form when dialog opens/closes or judge changes
  useEffect(() => {
    if (open) {
      if (judge) {
        reset({
          name: judge.name,
          system_prompt: judge.system_prompt,
          model_provider: judge.model_provider as 'openai' | 'anthropic',
          model_name: judge.model_name,
          active: judge.active,
          prompt_fields: judge.prompt_fields || DEFAULT_PROMPT_FIELDS,
        })
      } else {
        reset({
          name: '',
          system_prompt: DEFAULT_PROMPT,
          model_provider: 'openai',
          model_name: 'gpt-5-nano',
          active: true,
          prompt_fields: DEFAULT_PROMPT_FIELDS,
        })
      }
    }
  }, [open, judge, reset])

  // Update model_name when provider changes
  useEffect(() => {
    const currentModels = MODEL_OPTIONS[modelProvider]
    const currentModelName = watch('model_name')
    const isValidModel = currentModels.some(m => m.value === currentModelName)

    if (!isValidModel) {
      setValue('model_name', currentModels[0].value)
    }
  }, [modelProvider, setValue, watch])

  const handleFormSubmit = async (data: JudgeFormData) => {
    await onSubmit(data)
  }

  const togglePromptField = (key: keyof PromptFields) => {
    setValue('prompt_fields', {
      ...promptFields,
      [key]: !promptFields[key],
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit(handleFormSubmit)}>
          <DialogHeader>
            <DialogTitle>{judge ? 'Edit Judge' : 'Create New Judge'}</DialogTitle>
            <DialogDescription>
              {judge
                ? 'Update the judge configuration below.'
                : 'Configure an AI judge to evaluate submissions.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="e.g., Quality Checker"
                {...register('name', { required: 'Name is required' })}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            {/* Model Provider */}
            <div className="grid gap-2">
              <Label>Model Provider</Label>
              <Select
                value={modelProvider}
                onValueChange={(value: 'openai' | 'anthropic') => setValue('model_provider', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Model Name */}
            <div className="grid gap-2">
              <Label>Model</Label>
              <Select
                value={watch('model_name')}
                onValueChange={(value) => setValue('model_name', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODEL_OPTIONS[modelProvider].map((model) => (
                    <SelectItem key={model.value} value={model.value}>
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* System Prompt */}
            <div className="grid gap-2">
              <Label htmlFor="system_prompt">System Prompt / Rubric</Label>
              <Textarea
                id="system_prompt"
                placeholder="Enter the evaluation criteria..."
                className="min-h-[150px] font-mono text-sm"
                {...register('system_prompt', { required: 'System prompt is required' })}
              />
              {errors.system_prompt && (
                <p className="text-sm text-destructive">{errors.system_prompt.message}</p>
              )}
            </div>

            {/* Prompt Fields Configuration */}
            <div className="grid gap-2">
              <Label>Include in Prompt</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Select which fields to include when sending to the LLM
              </p>
              <div className="border rounded-md p-3 space-y-3">
                {PROMPT_FIELD_OPTIONS.map((option) => (
                  <div key={option.key} className="flex items-start space-x-3">
                    <Checkbox
                      id={option.key}
                      checked={promptFields?.[option.key] ?? true}
                      onCheckedChange={() => togglePromptField(option.key)}
                    />
                    <div className="grid gap-0.5 leading-none">
                      <label
                        htmlFor={option.key}
                        className="text-sm font-medium cursor-pointer"
                      >
                        {option.label}
                      </label>
                      <p className="text-xs text-muted-foreground">
                        {option.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Active</Label>
                <p className="text-sm text-muted-foreground">
                  Inactive judges won't be available for assignment
                </p>
              </div>
              <Switch
                checked={watch('active')}
                onCheckedChange={(checked) => setValue('active', checked)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : judge ? 'Save Changes' : 'Create Judge'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
