import { MoreHorizontal, Pencil, Power, PowerOff, Trash2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Judge {
  id: string
  name: string
  system_prompt: string
  model_provider: 'openai' | 'anthropic'
  model_name: string
  active: boolean
  created_at: string
  updated_at: string
}

interface JudgeCardProps {
  judge: Judge
  onEdit: (judge: Judge) => void
  onToggleActive: (judge: Judge) => void
  onDelete: (judge: Judge) => void
}

const MODEL_DISPLAY_NAMES: Record<string, string> = {
  'gpt-5-nano': 'GPT-5 Nano',
  'gpt-4o-mini': 'GPT-4o Mini',
  'gpt-4o': 'GPT-4o',
  'claude-sonnet-4-20250514': 'Claude Sonnet 4',
  'claude-3-5-sonnet-20241022': 'Claude 3.5 Sonnet',
  'claude-3-5-haiku-20241022': 'Claude 3.5 Haiku',
}

export function JudgeCard({ judge, onEdit, onToggleActive, onDelete }: JudgeCardProps) {
  return (
    <Card className={judge.active ? '' : 'opacity-60'}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">{judge.name}</CardTitle>
            <Badge variant={judge.active ? 'default' : 'secondary'}>
              {judge.active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <CardDescription className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              {judge.model_provider === 'openai' ? 'OpenAI' : 'Anthropic'}
            </Badge>
            <span>{MODEL_DISPLAY_NAMES[judge.model_name] || judge.model_name}</span>
          </CardDescription>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(judge)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onToggleActive(judge)}>
              {judge.active ? (
                <>
                  <PowerOff className="mr-2 h-4 w-4" />
                  Deactivate
                </>
              ) : (
                <>
                  <Power className="mr-2 h-4 w-4" />
                  Activate
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(judge)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <CardContent>
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">System Prompt</p>
          <pre className="text-sm bg-muted p-3 rounded-md overflow-auto max-h-32 whitespace-pre-wrap">
            {judge.system_prompt.length > 300
              ? judge.system_prompt.slice(0, 300) + '...'
              : judge.system_prompt}
          </pre>
        </div>
      </CardContent>
    </Card>
  )
}
