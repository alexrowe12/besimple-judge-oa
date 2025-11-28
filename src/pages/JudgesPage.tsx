import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Filter } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { JudgeForm } from '@/components/judges/JudgeForm'
import type { JudgeFormData } from '@/components/judges/JudgeForm'
import { JudgeCard } from '@/components/judges/JudgeCard'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import type { PromptFields } from '@/components/judges/JudgeForm'

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

type FilterValue = 'all' | 'active' | 'inactive'

export function JudgesPage() {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingJudge, setEditingJudge] = useState<Judge | null>(null)
  const [filter, setFilter] = useState<FilterValue>('all')
  const queryClient = useQueryClient()

  // Fetch judges
  const { data: judges, isLoading } = useQuery({
    queryKey: ['judges'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('judges')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as Judge[]
    },
  })

  // Create judge mutation
  const createMutation = useMutation({
    mutationFn: async (data: JudgeFormData) => {
      const { error } = await supabase.from('judges').insert([data])
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judges'] })
      toast.success('Judge created successfully')
      setIsFormOpen(false)
    },
    onError: (error) => {
      toast.error('Failed to create judge', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    },
  })

  // Update judge mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<JudgeFormData> }) => {
      const { error } = await supabase
        .from('judges')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judges'] })
      toast.success('Judge updated successfully')
      setIsFormOpen(false)
      setEditingJudge(null)
    },
    onError: (error) => {
      toast.error('Failed to update judge', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    },
  })

  // Delete judge mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('judges').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judges'] })
      toast.success('Judge deleted successfully')
    },
    onError: (error) => {
      toast.error('Failed to delete judge', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    },
  })

  const handleSubmit = async (data: JudgeFormData) => {
    if (editingJudge) {
      await updateMutation.mutateAsync({ id: editingJudge.id, data })
    } else {
      await createMutation.mutateAsync(data)
    }
  }

  const handleEdit = (judge: Judge) => {
    setEditingJudge(judge)
    setIsFormOpen(true)
  }

  const handleToggleActive = async (judge: Judge) => {
    await updateMutation.mutateAsync({
      id: judge.id,
      data: { active: !judge.active },
    })
  }

  const handleDelete = async (judge: Judge) => {
    if (confirm(`Are you sure you want to delete "${judge.name}"?`)) {
      await deleteMutation.mutateAsync(judge.id)
    }
  }

  const handleOpenChange = (open: boolean) => {
    setIsFormOpen(open)
    if (!open) {
      setEditingJudge(null)
    }
  }

  // Filter judges
  const filteredJudges = judges?.filter((judge) => {
    if (filter === 'active') return judge.active
    if (filter === 'inactive') return !judge.active
    return true
  })

  const activeCount = judges?.filter((j) => j.active).length || 0
  const inactiveCount = judges?.filter((j) => !j.active).length || 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">AI Judges</h2>
          <p className="text-muted-foreground">
            Create and manage AI judge definitions
          </p>
        </div>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Judge
        </Button>
      </div>

      {/* Stats & Filter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{judges?.length || 0} total</span>
          <span>{activeCount} active</span>
          <span>{inactiveCount} inactive</span>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filter} onValueChange={(v: FilterValue) => setFilter(v)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Judges Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-48 rounded-lg border bg-card animate-pulse"
            />
          ))}
        </div>
      ) : filteredJudges && filteredJudges.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredJudges.map((judge) => (
            <JudgeCard
              key={judge.id}
              judge={judge}
              onEdit={handleEdit}
              onToggleActive={handleToggleActive}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          {filter !== 'all' ? (
            <p>No {filter} judges found.</p>
          ) : (
            <>
              <p>No judges created yet.</p>
              <p className="text-sm mt-1">
                Click "Create Judge" to define your first AI evaluator.
              </p>
            </>
          )}
        </div>
      )}

      {/* Create/Edit Form Dialog */}
      <JudgeForm
        open={isFormOpen}
        onOpenChange={handleOpenChange}
        onSubmit={handleSubmit}
        judge={editingJudge}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  )
}
