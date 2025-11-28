import { Link } from 'react-router-dom'
import { ChevronRight, Inbox } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Queue {
  id: string
  name: string | null
  created_at: string
  submissions: { count: number }[]
}

interface QueueListProps {
  queues: Queue[]
  isLoading: boolean
}

export function QueueList({ queues, isLoading }: QueueListProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-32 rounded-lg border bg-card animate-pulse"
          />
        ))}
      </div>
    )
  }

  if (queues.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">No queues found</p>
          <p className="text-sm text-muted-foreground mt-1">
            Upload submission data to create queues
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {queues.map((queue) => {
        const submissionCount = queue.submissions?.[0]?.count || 0

        return (
          <Link key={queue.id} to={`/queues/${queue.id}`}>
            <Card className="hover:border-primary transition-colors cursor-pointer h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-medium">
                  {queue.name || queue.id}
                </CardTitle>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {submissionCount} submission{submissionCount !== 1 ? 's' : ''}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Created {new Date(queue.created_at).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}
