import { supabase } from '@/lib/supabase'

export interface UploadedFile {
  path: string
  url: string
  name: string
  type: string
  size: number
}

export async function uploadFile(
  file: File,
  questionId: string
): Promise<UploadedFile> {
  // Create a unique path for the file
  const ext = file.name.split('.').pop()
  const path = `${questionId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('attachments')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`)
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('attachments')
    .getPublicUrl(path)

  return {
    path,
    url: urlData.publicUrl,
    name: file.name,
    type: file.type,
    size: file.size,
  }
}

export async function deleteFile(path: string): Promise<void> {
  const { error } = await supabase.storage
    .from('attachments')
    .remove([path])

  if (error) {
    throw new Error(`Delete failed: ${error.message}`)
  }
}

export async function saveAttachmentRecord(
  questionId: string,
  file: UploadedFile
): Promise<void> {
  const { error } = await supabase.from('attachments').insert({
    question_id: questionId,
    file_name: file.name,
    file_type: file.type,
    file_size: file.size,
    storage_path: file.path,
    url: file.url,
  })

  if (error) {
    throw new Error(`Failed to save attachment record: ${error.message}`)
  }
}

export async function getAttachmentsForQuestion(
  questionId: string
): Promise<{ url: string; type: 'image' | 'pdf'; mimeType: string }[]> {
  const { data, error } = await supabase
    .from('attachments')
    .select('url, file_type')
    .eq('question_id', questionId)

  if (error) {
    console.warn('Failed to fetch attachments:', error)
    return []
  }

  return (data || []).map((a) => ({
    url: a.url,
    type: a.file_type?.startsWith('image/') ? 'image' : 'pdf',
    mimeType: a.file_type || 'application/octet-stream',
  }))
}

export async function deleteAttachmentRecord(id: string): Promise<void> {
  const { error } = await supabase.from('attachments').delete().eq('id', id)

  if (error) {
    throw new Error(`Failed to delete attachment: ${error.message}`)
  }
}
