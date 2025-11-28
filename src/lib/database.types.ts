export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      queues: {
        Row: {
          id: string
          name: string | null
          created_at: string
        }
        Insert: {
          id: string
          name?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string | null
          created_at?: string
        }
      }
      submissions: {
        Row: {
          id: string
          queue_id: string | null
          labeling_task_id: string | null
          original_created_at: number | null
          created_at: string
        }
        Insert: {
          id: string
          queue_id?: string | null
          labeling_task_id?: string | null
          original_created_at?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          queue_id?: string | null
          labeling_task_id?: string | null
          original_created_at?: number | null
          created_at?: string
        }
      }
      questions: {
        Row: {
          id: string
          submission_id: string | null
          template_id: string | null
          question_type: string | null
          question_text: string | null
          rev: number | null
          created_at: string
        }
        Insert: {
          id: string
          submission_id?: string | null
          template_id?: string | null
          question_type?: string | null
          question_text?: string | null
          rev?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          submission_id?: string | null
          template_id?: string | null
          question_type?: string | null
          question_text?: string | null
          rev?: number | null
          created_at?: string
        }
      }
      answers: {
        Row: {
          id: string
          question_id: string | null
          choice: string | null
          reasoning: string | null
          raw_value: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          question_id?: string | null
          choice?: string | null
          reasoning?: string | null
          raw_value?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          question_id?: string | null
          choice?: string | null
          reasoning?: string | null
          raw_value?: Json | null
          created_at?: string
        }
      }
      judges: {
        Row: {
          id: string
          name: string
          system_prompt: string
          model_provider: string
          model_name: string
          active: boolean
          prompt_fields: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          system_prompt: string
          model_provider: string
          model_name: string
          active?: boolean
          prompt_fields?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          system_prompt?: string
          model_provider?: string
          model_name?: string
          active?: boolean
          prompt_fields?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      attachments: {
        Row: {
          id: string
          question_id: string | null
          file_name: string
          file_type: string
          file_size: number | null
          storage_path: string
          url: string
          created_at: string
        }
        Insert: {
          id?: string
          question_id?: string | null
          file_name: string
          file_type: string
          file_size?: number | null
          storage_path: string
          url: string
          created_at?: string
        }
        Update: {
          id?: string
          question_id?: string | null
          file_name?: string
          file_type?: string
          file_size?: number | null
          storage_path?: string
          url?: string
          created_at?: string
        }
      }
      judge_assignments: {
        Row: {
          id: string
          judge_id: string | null
          queue_id: string | null
          question_template_id: string
          created_at: string
        }
        Insert: {
          id?: string
          judge_id?: string | null
          queue_id?: string | null
          question_template_id: string
          created_at?: string
        }
        Update: {
          id?: string
          judge_id?: string | null
          queue_id?: string | null
          question_template_id?: string
          created_at?: string
        }
      }
      evaluations: {
        Row: {
          id: string
          question_id: string | null
          judge_id: string | null
          verdict: string
          reasoning: string | null
          raw_response: Json | null
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          question_id?: string | null
          judge_id?: string | null
          verdict: string
          reasoning?: string | null
          raw_response?: Json | null
          error_message?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          question_id?: string | null
          judge_id?: string | null
          verdict?: string
          reasoning?: string | null
          raw_response?: Json | null
          error_message?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Convenience types
export type Queue = Database['public']['Tables']['queues']['Row']
export type Submission = Database['public']['Tables']['submissions']['Row']
export type Question = Database['public']['Tables']['questions']['Row']
export type Answer = Database['public']['Tables']['answers']['Row']
export type Judge = Database['public']['Tables']['judges']['Row']
export type Attachment = Database['public']['Tables']['attachments']['Row']
export type JudgeAssignment = Database['public']['Tables']['judge_assignments']['Row']
export type Evaluation = Database['public']['Tables']['evaluations']['Row']

// Insert types
export type JudgeInsert = Database['public']['Tables']['judges']['Insert']
export type EvaluationInsert = Database['public']['Tables']['evaluations']['Insert']
