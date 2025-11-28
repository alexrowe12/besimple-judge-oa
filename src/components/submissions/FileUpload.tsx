import { useCallback, useState } from 'react'
import { Upload, FileJson, CheckCircle2, AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface FileUploadProps {
  onFileSelect: (file: File) => void
  isLoading?: boolean
  error?: string | null
  success?: boolean
}

export function FileUpload({ onFileSelect, isLoading, error, success }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)

      const file = e.dataTransfer.files[0]
      if (file && file.type === 'application/json') {
        setFileName(file.name)
        onFileSelect(file)
      }
    },
    [onFileSelect]
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        setFileName(file.name)
        onFileSelect(file)
      }
    },
    [onFileSelect]
  )

  return (
    <Card
      className={cn(
        'border-2 border-dashed transition-colors',
        isDragging && 'border-primary bg-primary/5',
        error && 'border-destructive',
        success && 'border-green-500'
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <CardContent className="flex flex-col items-center justify-center py-12">
        {success ? (
          <>
            <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
            <p className="text-lg font-medium text-green-500">Upload Successful!</p>
            <p className="text-sm text-muted-foreground mt-1">{fileName}</p>
          </>
        ) : error ? (
          <>
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <p className="text-lg font-medium text-destructive">Upload Failed</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => document.getElementById('file-input')?.click()}
            >
              Try Again
            </Button>
          </>
        ) : isLoading ? (
          <>
            <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin mb-4" />
            <p className="text-lg font-medium">Processing...</p>
            <p className="text-sm text-muted-foreground mt-1">{fileName}</p>
          </>
        ) : (
          <>
            {fileName ? (
              <FileJson className="h-12 w-12 text-primary mb-4" />
            ) : (
              <Upload className="h-12 w-12 text-muted-foreground mb-4" />
            )}
            <p className="text-lg font-medium">
              {fileName || 'Drop your JSON file here'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              or click to browse
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => document.getElementById('file-input')?.click()}
            >
              Select File
            </Button>
          </>
        )}
        <input
          id="file-input"
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleFileInput}
        />
      </CardContent>
    </Card>
  )
}
