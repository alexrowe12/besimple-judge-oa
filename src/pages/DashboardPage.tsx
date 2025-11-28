import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function DashboardPage() {
  // Fetch total submissions count
  const { data: submissionsCount, isLoading: loadingSubmissions } = useQuery({
    queryKey: ['dashboard', 'submissions-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('submissions')
        .select('*', { count: 'exact', head: true })

      if (error) throw error
      return count || 0
    },
  })

  // Fetch active judges count
  const { data: activeJudgesCount, isLoading: loadingJudges } = useQuery({
    queryKey: ['dashboard', 'active-judges-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('judges')
        .select('*', { count: 'exact', head: true })
        .eq('active', true)

      if (error) throw error
      return count || 0
    },
  })

  // Fetch evaluations stats using efficient count queries
  const { data: evaluationStats, isLoading: loadingEvaluations } = useQuery({
    queryKey: ['dashboard', 'evaluation-stats'],
    queryFn: async () => {
      // Get total count
      const { count: total, error: totalError } = await supabase
        .from('evaluations')
        .select('*', { count: 'exact', head: true })

      if (totalError) throw totalError

      // Get passed count
      const { count: passed, error: passedError } = await supabase
        .from('evaluations')
        .select('*', { count: 'exact', head: true })
        .eq('verdict', 'pass')

      if (passedError) throw passedError

      return { total: total || 0, passed: passed || 0 }
    },
  })

  const passRate =
    evaluationStats && evaluationStats.total > 0
      ? Math.round((evaluationStats.passed / evaluationStats.total) * 100)
      : null

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Overview of your AI Judge evaluations
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingSubmissions ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{submissionsCount}</div>
            )}
            <p className="text-xs text-muted-foreground">
              {submissionsCount === 0 ? 'Upload JSON to get started' : 'Submissions ingested'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Judges</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingJudges ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{activeJudgesCount}</div>
            )}
            <p className="text-xs text-muted-foreground">
              {activeJudgesCount === 0 ? 'Create judges to evaluate' : 'Judges ready to run'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Evaluations</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingEvaluations ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{evaluationStats?.total || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">
              {!evaluationStats?.total ? 'Run AI judges to evaluate' : 'Evaluations completed'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pass Rate</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingEvaluations ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">
                {passRate !== null ? `${passRate}%` : '--'}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {passRate === null
                ? 'No evaluations yet'
                : `${evaluationStats?.passed} of ${evaluationStats?.total} passed`}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Getting Started</CardTitle>
          <CardDescription>Follow these steps to set up your AI Judge</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Go to <strong>Submissions</strong> and upload your JSON data file</li>
            <li>Go to <strong>Judges</strong> to create AI judge definitions with prompts</li>
            <li>Go to <strong>Queues</strong> to assign judges to questions</li>
            <li>Click <strong>Run AI Judges</strong> to execute evaluations</li>
            <li>View the <strong>Results</strong> page to see outcomes and statistics</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
