import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { QueueList } from '@/components/queues/QueueList'
import { QueueDetail } from '@/components/queues/QueueDetail'

interface Queue {
  id: string
  name: string | null
  created_at: string
  submissions: { count: number }[]
}

export function QueuesPage() {
  const { queueId } = useParams()

  // Fetch all queues with submission counts
  const { data: queues, isLoading: queuesLoading } = useQuery({
    queryKey: ['queues'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('queues')
        .select(`
          *,
          submissions(count)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as Queue[]
    },
  })

  // If a specific queue is selected, show detail view
  if (queueId) {
    return <QueueDetail queueId={queueId} />
  }

  // Otherwise show queue list
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Queues</h2>
        <p className="text-muted-foreground">
          View queues and assign judges to questions
        </p>
      </div>

      <QueueList queues={queues || []} isLoading={queuesLoading} />
    </div>
  )
}
