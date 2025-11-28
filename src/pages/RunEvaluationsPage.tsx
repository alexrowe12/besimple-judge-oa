import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Play, CheckCircle2, XCircle, Loader2, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getEvaluationTasksWithSkipped, runAllEvaluations } from '@/services/evaluationRunner'
import type { RunProgress, RunResult, TasksResult } from '@/services/evaluationRunner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type RunState = 'idle' | 'running' | 'completed' | 'error'

export function RunEvaluationsPage() {
  const { queueId } = useParams<{ queueId: string }>()
  const navigate = useNavigate()
  const [runState, setRunState] = useState<RunState>('idle')
  const [progress, setProgress] = useState<RunProgress>({ total: 0, completed: 0, failed: 0, skipped: 0 })
  const [result, setResult] = useState<RunResult | null>(null)
  const [error, setError] = useState<string | null>(null)

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
    enabled: !!queueId,
  })

  // Fetch tasks to show preview (includes skipped count)
  const { data: tasksResult, isLoading: tasksLoading } = useQuery({
    queryKey: ['evaluation-tasks', queueId],
    queryFn: async (): Promise<TasksResult> => {
      if (!queueId) return { tasks: [], skippedCount: 0 }
      return getEvaluationTasksWithSkipped(queueId)
    },
    enabled: !!queueId,
  })

  const tasks = tasksResult?.tasks
  const skippedCount = tasksResult?.skippedCount || 0

  const handleRun = async () => {
    if (!queueId) return

    setRunState('running')
    setError(null)
    setResult(null)

    try {
      const runResult = await runAllEvaluations(queueId, setProgress)
      setResult(runResult)
      setRunState('completed')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
      setRunState('error')
    }
  }

  // Group tasks by judge for preview
  const tasksByJudge = tasks?.reduce((acc, task) => {
    const judgeName = task.judge.name
    if (!acc[judgeName]) {
      acc[judgeName] = { count: 0, model: task.judge.model_name, provider: task.judge.model_provider }
    }
    acc[judgeName].count++
    return acc
  }, {} as Record<string, { count: number; model: string; provider: string }>)

  const progressPercent = progress.total > 0
    ? Math.round(((progress.completed + progress.failed) / progress.total) * 100)
    : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={`/queues/${queueId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h2 className="text-3xl font-bold tracking-tight">Run AI Judges</h2>
          <p className="text-muted-foreground">
            Queue: {queue?.name || queueId}
          </p>
        </div>
      </div>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle>Evaluation Status</CardTitle>
          <CardDescription>
            {runState === 'idle' && 'Ready to run evaluations'}
            {runState === 'running' && 'Running evaluations...'}
            {runState === 'completed' && 'Evaluation run completed'}
            {runState === 'error' && 'Evaluation run failed'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress Section */}
          {runState === 'running' && (
            <div className="space-y-4">
              {/* Progress bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Current task */}
              {progress.current && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="truncate">{progress.current}</span>
                </div>
              )}

              {/* Counters */}
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-3 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">{progress.total}</p>
                  <p className="text-xs text-muted-foreground">Planned</p>
                </div>
                <div className="text-center p-3 bg-green-500/10 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{progress.completed}</p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
                <div className="text-center p-3 bg-red-500/10 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{progress.failed}</p>
                  <p className="text-xs text-muted-foreground">Failed</p>
                </div>
                <div className="text-center p-3 bg-yellow-500/10 rounded-lg">
                  <p className="text-2xl font-bold text-yellow-600">{progress.skipped}</p>
                  <p className="text-xs text-muted-foreground">Skipped</p>
                </div>
              </div>
            </div>
          )}

          {/* Completed State */}
          {runState === 'completed' && result && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
                <div>
                  <p className="font-medium">Evaluation Complete!</p>
                  <p className="text-sm text-muted-foreground">
                    {result.completed} successful, {result.failed} failed out of {result.total} evaluations
                  </p>
                </div>
              </div>

              {/* Counters */}
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-3 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">{result.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
                <div className="text-center p-3 bg-green-500/10 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{result.completed}</p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
                <div className="text-center p-3 bg-red-500/10 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{result.failed}</p>
                  <p className="text-xs text-muted-foreground">Failed</p>
                </div>
                <div className="text-center p-3 bg-yellow-500/10 rounded-lg">
                  <p className="text-2xl font-bold text-yellow-600">{result.skipped}</p>
                  <p className="text-xs text-muted-foreground">Skipped</p>
                </div>
              </div>

              {/* Errors */}
              {result.errors.length > 0 && (
                <div className="p-3 bg-red-500/10 rounded-lg">
                  <p className="font-medium text-red-600 mb-2">Errors:</p>
                  <ul className="text-sm space-y-1">
                    {result.errors.slice(0, 5).map((err, i) => (
                      <li key={i} className="text-muted-foreground">{err}</li>
                    ))}
                    {result.errors.length > 5 && (
                      <li className="text-muted-foreground">...and {result.errors.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <Button onClick={() => navigate('/results')}>
                  View Results
                </Button>
                <Button variant="outline" onClick={() => {
                  setRunState('idle')
                  setResult(null)
                  setProgress({ total: 0, completed: 0, failed: 0, skipped: 0 })
                }}>
                  Run Again
                </Button>
              </div>
            </div>
          )}

          {/* Error State */}
          {runState === 'error' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <XCircle className="h-8 w-8 text-red-500" />
                <div>
                  <p className="font-medium text-red-500">Error</p>
                  <p className="text-sm text-muted-foreground">{error}</p>
                </div>
              </div>
              <Button variant="outline" onClick={() => setRunState('idle')}>
                Try Again
              </Button>
            </div>
          )}

          {/* Idle State - Show Preview */}
          {runState === 'idle' && (
            <div className="space-y-4">
              {tasksLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : tasks && tasks.length > 0 ? (
                <>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    <p className="text-sm">
                      This will run <strong>{tasks.length}</strong> evaluations and call the LLM APIs.
                      {skippedCount > 0 && (
                        <span className="text-muted-foreground">
                          {' '}({skippedCount} already evaluated - will be skipped)
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Preview by judge */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Evaluations by Judge:</p>
                    <div className="flex flex-wrap gap-2">
                      {tasksByJudge && Object.entries(tasksByJudge).map(([name, info]) => (
                        <Badge key={name} variant="outline" className="py-1">
                          {name}: {info.count} ({info.provider})
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <Button onClick={handleRun} size="lg" className="w-full">
                    <Play className="mr-2 h-4 w-4" />
                    Run {tasks.length} Evaluations
                  </Button>
                </>
              ) : skippedCount > 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
                  <p className="text-muted-foreground">All evaluations already completed!</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {skippedCount} evaluation{skippedCount !== 1 ? 's' : ''} already exist for this queue.
                  </p>
                  <div className="flex gap-3 justify-center mt-4">
                    <Button onClick={() => navigate('/results')}>
                      View Results
                    </Button>
                    <Link to={`/queues/${queueId}`}>
                      <Button variant="outline">
                        Manage Assignments
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No evaluations to run.</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Make sure you've assigned judges to question templates.
                  </p>
                  <Link to={`/queues/${queueId}`}>
                    <Button variant="outline" className="mt-4">
                      Assign Judges
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
