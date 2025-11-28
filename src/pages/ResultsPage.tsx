import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { CheckCircle2, XCircle, HelpCircle, Filter, BarChart3, Download } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

interface Evaluation {
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

const CHART_COLORS = {
  pass: '#22c55e',
  fail: '#ef4444',
  inconclusive: '#eab308',
}

export function ResultsPage() {
  const [selectedJudges, setSelectedJudges] = useState<string[]>([])
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([])
  const [verdictFilter, setVerdictFilter] = useState<string>('all')

  // Fetch all evaluations with related data
  const { data: evaluations, isLoading } = useQuery({
    queryKey: ['evaluations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evaluations')
        .select(`
          id,
          verdict,
          reasoning,
          created_at,
          question_id,
          judge_id,
          questions(id, question_text, submission_id),
          judges(id, name)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as unknown as Evaluation[]
    },
  })

  // Get unique judges and questions for filters
  const filterOptions = useMemo(() => {
    if (!evaluations) return { judges: [], questions: [] }

    const judgeMap = new Map<string, string>()
    const questionMap = new Map<string, string>()

    evaluations.forEach((e) => {
      if (e.judges) {
        judgeMap.set(e.judges.id, e.judges.name)
      }
      if (e.questions) {
        const questionPreview = e.questions.question_text?.slice(0, 50) + (e.questions.question_text?.length > 50 ? '...' : '')
        questionMap.set(e.questions.id, questionPreview)
      }
    })

    return {
      judges: Array.from(judgeMap.entries()).map(([id, name]) => ({ id, name })),
      questions: Array.from(questionMap.entries()).map(([id, text]) => ({ id, text })),
    }
  }, [evaluations])

  // Filter evaluations
  const filteredEvaluations = useMemo(() => {
    if (!evaluations) return []

    return evaluations.filter((e) => {
      // Judge filter
      if (selectedJudges.length > 0 && !selectedJudges.includes(e.judge_id)) {
        return false
      }

      // Question filter
      if (selectedQuestions.length > 0 && !selectedQuestions.includes(e.question_id)) {
        return false
      }

      // Verdict filter
      if (verdictFilter !== 'all' && e.verdict !== verdictFilter) {
        return false
      }

      return true
    })
  }, [evaluations, selectedJudges, selectedQuestions, verdictFilter])

  // Calculate stats
  const stats = useMemo(() => {
    const total = filteredEvaluations.length
    const pass = filteredEvaluations.filter((e) => e.verdict === 'pass').length
    const fail = filteredEvaluations.filter((e) => e.verdict === 'fail').length
    const inconclusive = filteredEvaluations.filter((e) => e.verdict === 'inconclusive').length
    const passRate = total > 0 ? Math.round((pass / total) * 100) : 0

    return { total, pass, fail, inconclusive, passRate }
  }, [filteredEvaluations])

  // Calculate pass rate by judge for chart
  const judgeChartData = useMemo(() => {
    if (!filteredEvaluations.length) return []

    const judgeStats = new Map<string, { name: string; pass: number; fail: number; inconclusive: number; total: number }>()

    filteredEvaluations.forEach((e) => {
      const judgeName = e.judges?.name || 'Unknown'
      const judgeId = e.judge_id

      if (!judgeStats.has(judgeId)) {
        judgeStats.set(judgeId, { name: judgeName, pass: 0, fail: 0, inconclusive: 0, total: 0 })
      }

      const stats = judgeStats.get(judgeId)!
      stats.total++
      if (e.verdict === 'pass') stats.pass++
      else if (e.verdict === 'fail') stats.fail++
      else stats.inconclusive++
    })

    return Array.from(judgeStats.values()).map((s) => ({
      name: s.name,
      passRate: s.total > 0 ? Math.round((s.pass / s.total) * 100) : 0,
      pass: s.pass,
      fail: s.fail,
      inconclusive: s.inconclusive,
      total: s.total,
    }))
  }, [filteredEvaluations])

  // Pie chart data for verdict distribution
  const verdictPieData = useMemo(() => {
    return [
      { name: 'Pass', value: stats.pass, color: CHART_COLORS.pass },
      { name: 'Fail', value: stats.fail, color: CHART_COLORS.fail },
      { name: 'Inconclusive', value: stats.inconclusive, color: CHART_COLORS.inconclusive },
    ].filter((d) => d.value > 0)
  }, [stats])

  const toggleJudge = (judgeId: string) => {
    setSelectedJudges((prev) =>
      prev.includes(judgeId)
        ? prev.filter((id) => id !== judgeId)
        : [...prev, judgeId]
    )
  }

  const toggleQuestion = (questionId: string) => {
    setSelectedQuestions((prev) =>
      prev.includes(questionId)
        ? prev.filter((id) => id !== questionId)
        : [...prev, questionId]
    )
  }

  const clearFilters = () => {
    setSelectedJudges([])
    setSelectedQuestions([])
    setVerdictFilter('all')
  }

  const hasFilters = selectedJudges.length > 0 || selectedQuestions.length > 0 || verdictFilter !== 'all'

  const getVerdictIcon = (verdict: string) => {
    switch (verdict) {
      case 'pass':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'fail':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <HelpCircle className="h-4 w-4 text-yellow-500" />
    }
  }

  const getVerdictBadge = (verdict: string) => {
    switch (verdict) {
      case 'pass':
        return <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20">Pass</Badge>
      case 'fail':
        return <Badge className="bg-red-500/10 text-red-600 hover:bg-red-500/20">Fail</Badge>
      default:
        return <Badge className="bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20">Inconclusive</Badge>
    }
  }

  // Convert evaluations to CSV format
  const exportToCSV = () => {
    if (filteredEvaluations.length === 0) return

    const headers = ['Question', 'Judge', 'Verdict', 'Reasoning', 'Created At']

    const rows = filteredEvaluations.map((e) => [
      // Escape quotes and wrap in quotes to handle commas/newlines in text
      `"${(e.questions?.question_text || 'Unknown').replace(/"/g, '""')}"`,
      `"${(e.judges?.name || 'Unknown').replace(/"/g, '""')}"`,
      e.verdict,
      `"${(e.reasoning || '').replace(/"/g, '""')}"`,
      format(new Date(e.created_at), 'yyyy-MM-dd HH:mm:ss'),
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n')

    // Create blob and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `evaluations-${format(new Date(), 'yyyy-MM-dd-HHmm')}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Results</h2>
          <p className="text-muted-foreground">
            View evaluation results and statistics
          </p>
        </div>
        <Button
          variant="outline"
          onClick={exportToCSV}
          disabled={filteredEvaluations.length === 0}
        >
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Stats Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Pass Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="text-4xl font-bold">
              {stats.passRate}%
            </div>
            <div className="text-sm text-muted-foreground">
              pass of {stats.total} evaluations
            </div>
            <div className="flex-1" />
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>{stats.pass} pass</span>
              </div>
              <div className="flex items-center gap-1">
                <XCircle className="h-4 w-4 text-red-500" />
                <span>{stats.fail} fail</span>
              </div>
              <div className="flex items-center gap-1">
                <HelpCircle className="h-4 w-4 text-yellow-500" />
                <span>{stats.inconclusive} inconclusive</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      {filteredEvaluations.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Pass Rate by Judge Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Pass Rate by Judge
              </CardTitle>
              <CardDescription>
                Percentage of evaluations that passed per judge
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={judgeChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value: number) => [`${value}%`, 'Pass Rate']}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar
                      dataKey="passRate"
                      fill={CHART_COLORS.pass}
                      radius={[0, 4, 4, 0]}
                      animationDuration={1000}
                      animationBegin={0}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Verdict Distribution Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Verdict Distribution</CardTitle>
              <CardDescription>
                Breakdown of all evaluation outcomes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={verdictPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      animationDuration={1000}
                      animationBegin={0}
                    >
                      {verdictPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number, name: string) => [value, name]}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Judge Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="mr-2 h-4 w-4" />
              Judge
              {selectedJudges.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {selectedJudges.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64" align="start">
            <div className="space-y-2">
              <p className="text-sm font-medium">Filter by Judge</p>
              {filterOptions.judges.map((judge) => (
                <div key={judge.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`judge-${judge.id}`}
                    checked={selectedJudges.includes(judge.id)}
                    onCheckedChange={() => toggleJudge(judge.id)}
                  />
                  <Label htmlFor={`judge-${judge.id}`} className="text-sm">
                    {judge.name}
                  </Label>
                </div>
              ))}
              {filterOptions.judges.length === 0 && (
                <p className="text-sm text-muted-foreground">No judges found</p>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Question Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="mr-2 h-4 w-4" />
              Question
              {selectedQuestions.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {selectedQuestions.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="start">
            <div className="space-y-2 max-h-64 overflow-y-auto">
              <p className="text-sm font-medium">Filter by Question</p>
              {filterOptions.questions.map((question) => (
                <div key={question.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`question-${question.id}`}
                    checked={selectedQuestions.includes(question.id)}
                    onCheckedChange={() => toggleQuestion(question.id)}
                  />
                  <Label htmlFor={`question-${question.id}`} className="text-sm truncate">
                    {question.text}
                  </Label>
                </div>
              ))}
              {filterOptions.questions.length === 0 && (
                <p className="text-sm text-muted-foreground">No questions found</p>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Verdict Filter */}
        <Select value={verdictFilter} onValueChange={setVerdictFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All verdicts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All verdicts</SelectItem>
            <SelectItem value="pass">Pass</SelectItem>
            <SelectItem value="fail">Fail</SelectItem>
            <SelectItem value="inconclusive">Inconclusive</SelectItem>
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>

      {/* Results Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Loading evaluations...</p>
            </div>
          ) : filteredEvaluations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground">No evaluations found</p>
              {hasFilters && (
                <Button variant="link" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Question</TableHead>
                  <TableHead className="w-[140px]">Judge</TableHead>
                  <TableHead className="w-[120px]">Verdict</TableHead>
                  <TableHead>Reasoning</TableHead>
                  <TableHead className="w-[140px]">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvaluations.map((evaluation) => (
                  <TableRow key={evaluation.id}>
                    <TableCell>
                      <p className="text-sm line-clamp-2">
                        {evaluation.questions?.question_text || 'Unknown'}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{evaluation.judges?.name || 'Unknown'}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getVerdictIcon(evaluation.verdict)}
                        {getVerdictBadge(evaluation.verdict)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {evaluation.reasoning}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(evaluation.created_at), 'MMM d, h:mm a')}
                      </p>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
