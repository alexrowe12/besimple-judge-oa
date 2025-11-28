import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileUpload } from '@/components/submissions/FileUpload'
import { ingestSubmissions } from '@/services/ingestion'
import type { IngestionResult } from '@/services/ingestion'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface SubmissionRow {
  id: string
  queue_id: string | null
  labeling_task_id: string | null
  original_created_at: number | null
  created_at: string
  queues: { name: string } | null
  questions: { count: number }[]
}

export function SubmissionsPage() {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState(false)

  // Fetch submissions with their questions count
  const { data: submissions, refetch } = useQuery({
    queryKey: ['submissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('submissions')
        .select(`
          *,
          queues(name),
          questions(count)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as SubmissionRow[]
    },
  })

  const handleFileSelect = async (file: File) => {
    setIsUploading(true)
    setUploadError(null)
    setUploadSuccess(false)

    const result: IngestionResult = await ingestSubmissions(file)

    setIsUploading(false)

    if (result.success) {
      setUploadSuccess(true)
      toast.success('Data imported successfully', {
        description: `${result.submissionsCount} submissions, ${result.questionsCount} questions imported`,
      })
      refetch()
      // Reset success state after 3 seconds
      setTimeout(() => setUploadSuccess(false), 3000)
    } else {
      setUploadError(result.error || 'Unknown error')
      toast.error('Import failed', {
        description: result.error,
      })
    }
  }

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return '-'
    return new Date(timestamp).toLocaleDateString()
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Submissions</h2>
        <p className="text-muted-foreground">
          Upload and manage submission data
        </p>
      </div>

      {/* File Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle>Import Data</CardTitle>
          <CardDescription>
            Upload a JSON file containing submissions to evaluate
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FileUpload
            onFileSelect={handleFileSelect}
            isLoading={isUploading}
            error={uploadError}
            success={uploadSuccess}
          />
        </CardContent>
      </Card>

      {/* Submissions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Uploaded Submissions</CardTitle>
          <CardDescription>
            {submissions?.length || 0} submissions in database
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submissions && submissions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Queue</TableHead>
                  <TableHead>Questions</TableHead>
                  <TableHead>Original Date</TableHead>
                  <TableHead>Imported</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((submission) => (
                  <TableRow key={submission.id}>
                    <TableCell className="font-mono text-sm">
                      {submission.id}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {submission.queues?.name || submission.queue_id}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {submission.questions?.[0]?.count || 0}
                    </TableCell>
                    <TableCell>
                      {formatDate(submission.original_created_at)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(submission.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No submissions yet. Upload a JSON file to get started.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
