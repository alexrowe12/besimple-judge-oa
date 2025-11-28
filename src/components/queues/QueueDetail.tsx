import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Play, Paperclip } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { AttachmentUpload } from '@/components/attachments/AttachmentUpload'

interface Judge {
  id: string
  name: string
  model_provider: string
  model_name: string
  active: boolean
}

interface Question {
  id: string
  template_id: string
  question_type: string
  question_text: string
  submission_id: string
}

interface QuestionTemplate {
  template_id: string
  question_type: string
  question_text: string
  questions: Question[]
}

interface Assignment {
  id: string
  judge_id: string
  queue_id: string
  question_template_id: string
}

interface QueueDetailProps {
  queueId: string
}

export function QueueDetail({ queueId }: QueueDetailProps) {
  const queryClient = useQueryClient()

  // Fetch queue info
  const { data: queue } = useQuery({
    queryKey: ['queue', queueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('queues')
        .select('*')
        .eq('id', queueId)
        .single()

      if (error) throw error
      return data
    },
  })

  // Fetch unique question templates for this queue with individual questions
  const { data: questionTemplates, isLoading: questionsLoading } = useQuery({
    queryKey: ['question-templates', queueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('questions')
        .select(`
          id,
          template_id,
          question_type,
          question_text,
          submission_id,
          submissions!inner(queue_id)
        `)
        .eq('submissions.queue_id', queueId)

      if (error) throw error

      // Group by template_id
      const templateMap = new Map<string, QuestionTemplate>()
      for (const q of data || []) {
        if (!templateMap.has(q.template_id)) {
          templateMap.set(q.template_id, {
            template_id: q.template_id,
            question_type: q.question_type,
            question_text: q.question_text,
            questions: [],
          })
        }
        templateMap.get(q.template_id)!.questions.push({
          id: q.id,
          template_id: q.template_id,
          question_type: q.question_type,
          question_text: q.question_text,
          submission_id: q.submission_id,
        })
      }

      return Array.from(templateMap.values())
    },
  })

  // Fetch active judges
  const { data: judges } = useQuery({
    queryKey: ['judges', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('judges')
        .select('*')
        .eq('active', true)
        .order('name')

      if (error) throw error
      return data as Judge[]
    },
  })

  // Fetch current assignments for this queue
  const { data: assignments } = useQuery({
    queryKey: ['assignments', queueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('judge_assignments')
        .select('*')
        .eq('queue_id', queueId)

      if (error) throw error
      return data as Assignment[]
    },
  })

  // Toggle assignment mutation
  const toggleAssignment = useMutation({
    mutationFn: async ({
      judgeId,
      templateId,
      isAssigned,
    }: {
      judgeId: string
      templateId: string
      isAssigned: boolean
    }) => {
      if (isAssigned) {
        // Remove assignment
        const { error } = await supabase
          .from('judge_assignments')
          .delete()
          .eq('judge_id', judgeId)
          .eq('queue_id', queueId)
          .eq('question_template_id', templateId)

        if (error) throw error
      } else {
        // Add assignment
        const { error } = await supabase.from('judge_assignments').insert({
          judge_id: judgeId,
          queue_id: queueId,
          question_template_id: templateId,
        })

        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments', queueId] })
    },
    onError: (error) => {
      toast.error('Failed to update assignment', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    },
  })

  // Check if a judge is assigned to a template
  const isAssigned = (judgeId: string, templateId: string) => {
    return assignments?.some(
      (a) => a.judge_id === judgeId && a.question_template_id === templateId
    )
  }

  // Count total assignments
  const totalAssignments = assignments?.length || 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/queues">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h2 className="text-3xl font-bold tracking-tight">
            {queue?.name || queueId}
          </h2>
          <p className="text-muted-foreground">
            Assign judges to question templates
          </p>
        </div>
        <Link to={`/queues/${queueId}/run`}>
          <Button disabled={totalAssignments === 0}>
            <Play className="mr-2 h-4 w-4" />
            Run AI Judges
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>{questionTemplates?.length || 0} question templates</span>
        <span>{judges?.length || 0} active judges</span>
        <span>{totalAssignments} assignments</span>
      </div>

      {/* No judges warning */}
      {judges?.length === 0 && (
        <Card className="border-yellow-500 bg-yellow-500/10">
          <CardContent className="py-4">
            <p className="text-sm">
              No active judges found.{' '}
              <Link to="/judges" className="text-primary underline">
                Create a judge
              </Link>{' '}
              to assign it to questions.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Question Templates with Judge Assignment */}
      {questionsLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-lg border bg-card animate-pulse" />
          ))}
        </div>
      ) : questionTemplates && questionTemplates.length > 0 ? (
        <div className="space-y-4">
          {questionTemplates.map((template) => (
            <Card key={template.template_id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base font-medium">
                      {template.question_text}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="font-mono text-xs">
                        {template.template_id}
                      </Badge>
                      <span>{template.question_type}</span>
                      <span>({template.questions.length} instances)</span>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Assigned Judges */}
                <div>
                  <p className="text-sm font-medium mb-3">Assigned Judges:</p>
                  {judges && judges.length > 0 ? (
                    <div className="flex flex-wrap gap-3">
                      {judges.map((judge) => {
                        const assigned = isAssigned(judge.id, template.template_id)
                        return (
                          <label
                            key={judge.id}
                            className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors ${
                              assigned
                                ? 'bg-primary/10 border-primary'
                                : 'hover:bg-muted'
                            }`}
                          >
                            <Checkbox
                              checked={assigned}
                              onCheckedChange={() =>
                                toggleAssignment.mutate({
                                  judgeId: judge.id,
                                  templateId: template.template_id,
                                  isAssigned: assigned || false,
                                })
                              }
                            />
                            <span className="text-sm">{judge.name}</span>
                            <Badge variant="secondary" className="text-xs">
                              {judge.model_provider === 'openai' ? 'OpenAI' : 'Anthropic'}
                            </Badge>
                          </label>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No active judges available
                    </p>
                  )}
                </div>

                {/* Attachments Section */}
                <div className="border-t pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Paperclip className="h-4 w-4" />
                    <p className="text-sm font-medium">Attachments</p>
                  </div>
                  <div className="space-y-3">
                    {template.questions.map((question, idx) => (
                      <div key={question.id} className="pl-4 border-l-2">
                        <p className="text-xs text-muted-foreground mb-2">
                          Instance {idx + 1} (Submission: {question.submission_id.slice(0, 8)}...)
                        </p>
                        <AttachmentUpload questionId={question.id} />
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No questions found in this queue
          </CardContent>
        </Card>
      )}
    </div>
  )
}
