# BeSimple AI Judge

A web application for automatically evaluating human-annotated answers using AI judges. Upload submission data, configure AI judges with custom prompts, and run evaluations against OpenAI or Anthropic models.

## Features

### Core Functionality
- **Data Ingestion** - Upload JSON files containing submissions with questions and answers
- **AI Judge CRUD** - Create, edit, and deactivate AI judges with custom system prompts
- **Judge Assignment** - Assign one or more judges to specific question templates per queue
- **Evaluation Runner** - Execute evaluations against real LLM APIs (OpenAI, Anthropic)
- **Results Dashboard** - View evaluations with filters, pass rate statistics, and charts

### Bonus Features
- **File Attachments** - Upload images and PDFs to include in evaluations (with multimodal LLM support)
- **Prompt Field Selection** - Configure which fields (question text, answer, reasoning) are sent to the LLM
- **Animated Charts** - Pass rate by judge bar chart and verdict distribution pie chart
- **CSV Export** - Export filtered results to CSV

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **UI**: Tailwind CSS, shadcn/ui components
- **State Management**: TanStack React Query
- **Backend**: Supabase (PostgreSQL + Storage)
- **LLM Providers**: OpenAI, Anthropic
- **Charts**: Recharts

## Setup

### Prerequisites
- Node.js 18+
- npm
- Supabase account (free tier works)
- OpenAI and/or Anthropic API keys

### 1. Clone and Install

```bash
npm install
```

### 2. Supabase Setup

Create a new Supabase project and run the following SQL to create the schema:

```sql
-- Queues table
CREATE TABLE queues (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Submissions table
CREATE TABLE submissions (
  id TEXT PRIMARY KEY,
  queue_id TEXT REFERENCES queues(id),
  labeling_task_id TEXT,
  original_created_at BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Questions table
CREATE TABLE questions (
  id TEXT PRIMARY KEY,
  submission_id TEXT REFERENCES submissions(id),
  template_id TEXT NOT NULL,
  question_type TEXT,
  question_text TEXT,
  rev INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Answers table
CREATE TABLE answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id TEXT REFERENCES questions(id),
  choice TEXT,
  reasoning TEXT,
  raw_value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Judges table
CREATE TABLE judges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  model_provider TEXT NOT NULL CHECK (model_provider IN ('openai', 'anthropic')),
  model_name TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  prompt_fields JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Judge assignments table
CREATE TABLE judge_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id TEXT REFERENCES queues(id),
  question_template_id TEXT NOT NULL,
  judge_id UUID REFERENCES judges(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(queue_id, question_template_id, judge_id)
);

-- Evaluations table
CREATE TABLE evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id TEXT REFERENCES questions(id),
  judge_id UUID REFERENCES judges(id),
  verdict TEXT NOT NULL CHECK (verdict IN ('pass', 'fail', 'inconclusive')),
  reasoning TEXT,
  raw_response JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(question_id, judge_id)
);

-- Attachments table
CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id TEXT REFERENCES questions(id),
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_submissions_queue_id ON submissions(queue_id);
CREATE INDEX idx_questions_submission_id ON questions(submission_id);
CREATE INDEX idx_questions_template_id ON questions(template_id);
CREATE INDEX idx_answers_question_id ON answers(question_id);
CREATE INDEX idx_evaluations_question_id ON evaluations(question_id);
CREATE INDEX idx_evaluations_judge_id ON evaluations(judge_id);
CREATE INDEX idx_evaluations_verdict ON evaluations(verdict);
CREATE INDEX idx_judge_assignments_queue_id ON judge_assignments(queue_id);
CREATE INDEX idx_attachments_question_id ON attachments(question_id);
```

Also create a storage bucket named `attachments` with public access for file uploads.

### 3. Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_OPENAI_API_KEY=sk-...
VITE_ANTHROPIC_API_KEY=sk-ant-...
```

### 4. Run the Application

```bash
npm run dev
```

Open http://localhost:5173

## Usage

1. **Upload Data** - Go to Submissions and upload a JSON file matching the expected format
2. **Create Judges** - Go to Judges and create AI judges with system prompts
3. **Assign Judges** - Go to Queues, select a queue, and assign judges to question templates
4. **Run Evaluations** - Click "Run AI Judges" to execute evaluations
5. **View Results** - Go to Results to see outcomes with filters and statistics

## Architecture Decisions

- **Client-side LLM calls**: API calls are made directly from the browser to simplify the architecture. In production, these should be proxied through a backend to protect API keys.

- **Batch operations**: Large data imports are batched (500 items) to avoid Supabase payload limits.

- **Rate limiting**: LLM calls include exponential backoff retry logic (3 retries) for rate limit errors.

- **Duplicate prevention**: Evaluations are skipped if a (question, judge) pair already exists.

- **Multimodal support**: Images work with both OpenAI and Anthropic. PDFs are supported by Anthropic only.

## Trade-offs

- **Client-side LLM calls** - API keys are exposed in browser for simplicity. Production would use a backend proxy to protect
  keys.

- **Client-side pagination/filtering** - Results are filtered in-memory after fetching. Works fine for <10k evaluations; would
need server-side pagination for larger scale.

- **Sequential evaluation execution** - LLM calls run one at a time to avoid rate limits. Parallel execution with proper
queuing would be faster but more complex.

- **No authentication** - Single-user app for demo purposes. Production would need auth and multi-tenancy.

- **Supabase for everything** - Used Supabase for DB + storage for fast development. Production might split concerns (dedicated
DB, S3 for files, etc.).

- **No real-time updates** - Evaluation progress uses polling via React Query. WebSockets would provide smoother UX but add
complexity.

## Time Spent

- Total: ~4 hours

---

Built for the BeSimple AI coding challenge.
