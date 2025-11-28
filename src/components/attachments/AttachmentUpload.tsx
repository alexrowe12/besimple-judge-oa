import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload, X, Image, FileText, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { uploadFile, saveAttachmentRecord, deleteFile } from '@/services/storage'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface AttachmentRecord {
  id: string
  file_name: string
  file_type: string
  file_size: number
  storage_path: string
  url: string
}

interface AttachmentUploadProps {
  questionId: string
}

export function AttachmentUpload({ questionId }: AttachmentUploadProps) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)

  // Fetch existing attachments
  const { data: attachments } = useQuery({
    queryKey: ['attachments', questionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attachments')
        .select('*')
        .eq('question_id', questionId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as AttachmentRecord[]
    },
  })

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const uploaded = await uploadFile(file, questionId)
      await saveAttachmentRecord(questionId, uploaded)
      return uploaded
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attachments', questionId] })
      toast.success('File uploaded successfully')
    },
    onError: (error) => {
      toast.error('Upload failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (attachment: AttachmentRecord) => {
      await deleteFile(attachment.storage_path)
      const { error } = await supabase
        .from('attachments')
        .delete()
        .eq('id', attachment.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attachments', questionId] })
      toast.success('Attachment deleted')
    },
    onError: (error) => {
      toast.error('Delete failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    },
  })

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return

    setIsUploading(true)
    try {
      for (const file of Array.from(files)) {
        // Validate file type
        if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
          toast.error(`Unsupported file type: ${file.name}`, {
            description: 'Only images and PDFs are supported',
          })
          continue
        }

        // Validate file size (10MB max)
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`File too large: ${file.name}`, {
            description: 'Maximum file size is 10MB',
          })
          continue
        }

        await uploadMutation.mutateAsync(file)
      }
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) {
      return <Image className="h-4 w-4" />
    }
    return <FileText className="h-4 w-4" />
  }

  return (
    <div className="space-y-3">
      {/* Upload button */}
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          {isUploading ? 'Uploading...' : 'Attach File'}
        </Button>
        <span className="text-xs text-muted-foreground">
          Images or PDFs, max 10MB
        </span>
      </div>

      {/* Attachment list */}
      {attachments && attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="group flex items-center gap-2 px-2 py-1 bg-muted rounded-md text-sm"
            >
              {getFileIcon(attachment.file_type)}
              <a
                href={attachment.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline max-w-[150px] truncate"
              >
                {attachment.file_name}
              </a>
              <span className="text-xs text-muted-foreground">
                ({formatFileSize(attachment.file_size)})
              </span>
              <button
                onClick={() => deleteMutation.mutate(attachment)}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove attachment"
              >
                <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
