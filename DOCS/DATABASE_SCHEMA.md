# 데이터베이스 스키마 설계 문서

이 문서는 Aone 프로젝트의 Supabase 데이터베이스 테이블 구조를 정의합니다.

## 테이블 목록

1. **folders** - 폴더 트리 구조
2. **files** - 업로드 파일 메타데이터
3. **slide_summaries** - 슬라이드별 요약
4. **document_full_summaries** - 문서 전체 요약
5. **slide_audio_segments** - 슬라이드-음성 매칭 정보
6. **audio_transcripts** - STT 전사본
7. **folder_summaries** - 폴더 요약
8. **chunks** - RAG용 텍스트 청크
9. **chunk_embeddings** - 벡터 임베딩 (pgvector)
10. **jobs** - 비동기 작업 큐
11. **qa_logs** - 질문/답변 기록

## 테이블 상세 스키마

### 1. folders

폴더 트리 구조를 관리하는 테이블. `parent_id`를 통해 트리 구조를 구현합니다.

```sql
CREATE TABLE folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES folders(id) ON DELETE CASCADE,
  name text NOT NULL,
  user_id uuid NOT NULL,  -- Supabase Auth users.id 참조
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,  -- 소프트 삭제
  CONSTRAINT folders_name_not_empty CHECK (length(trim(name)) > 0)
);

-- 인덱스
CREATE INDEX idx_folders_parent ON folders(parent_id);
CREATE INDEX idx_folders_user ON folders(user_id);
CREATE INDEX idx_folders_deleted ON folders(deleted_at) WHERE deleted_at IS NULL;

-- 순환 참조 방지 트리거 (선택적)
```

### 2. files

업로드된 파일(PDF, Audio)의 메타데이터를 저장합니다.

```sql
CREATE TABLE files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id uuid NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('pdf', 'audio')),
  storage_path text NOT NULL,  -- Supabase Storage 경로
  name text NOT NULL,
  size bigint,  -- 파일 크기 (bytes)
  duration integer,  -- 음성 파일 길이 (초)
  page_count integer,  -- PDF 페이지 수
  user_id uuid NOT NULL,  -- Supabase Auth users.id 참조
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT files_name_not_empty CHECK (length(trim(name)) > 0)
);

-- 인덱스
CREATE INDEX idx_files_folder ON files(folder_id);
CREATE INDEX idx_files_user ON files(user_id);
CREATE INDEX idx_files_type ON files(type);
```

### 3. slide_summaries

PDF 문서의 각 슬라이드(페이지)별 요약을 저장합니다. 리치 텍스트 포맷팅을 지원합니다.

```sql
CREATE TABLE slide_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  slide_number integer NOT NULL,
  summary_content jsonb,  -- AI 생성 요약 (TipTap JSON 형식)
  user_notes_content jsonb,  -- 사용자 추가 정리 (TipTap JSON 형식)
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT slide_summaries_slide_number_positive CHECK (slide_number > 0),
  CONSTRAINT slide_summaries_unique_doc_slide UNIQUE(document_id, slide_number)
);

-- 인덱스
CREATE INDEX idx_slide_summaries_doc ON slide_summaries(document_id);
CREATE INDEX idx_slide_summaries_slide ON slide_summaries(document_id, slide_number);
CREATE INDEX idx_slide_summaries_summary_content ON slide_summaries USING gin(summary_content);  -- JSONB 검색용
CREATE INDEX idx_slide_summaries_user_notes_content ON slide_summaries USING gin(user_notes_content);  -- JSONB 검색용
```

**리치 텍스트 포맷팅:**
- `summary_content`: AI가 생성한 슬라이드 요약 (TipTap JSON 형식)
- `user_notes_content`: 사용자가 추가/수정한 노트 (TipTap JSON 형식)
- TipTap JSON 형식은 ProseMirror 문서 구조를 따릅니다
- 지원 포맷: 볼드, 이탤릭, 밑줄, 취소선, 색상, 하이라이트, 폰트 크기, 링크 등

### 4. document_full_summaries

문서 전체 요약을 저장합니다. 문서당 1개의 요약만 존재합니다. 리치 텍스트 포맷팅을 지원합니다.

```sql
CREATE TABLE document_full_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  summary_content jsonb NOT NULL,  -- 전체 요약 (TipTap JSON 형식)
  highlighted_sections jsonb,  -- 강조된 부분들 (TipTap JSON 형식 배열)
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT document_full_summaries_unique_doc UNIQUE(document_id)
);

-- 인덱스
CREATE INDEX idx_document_full_summaries_doc ON document_full_summaries(document_id);
CREATE INDEX idx_document_full_summaries_summary_content ON document_full_summaries USING gin(summary_content);  -- JSONB 검색용
CREATE INDEX idx_document_full_summaries_highlighted_sections ON document_full_summaries USING gin(highlighted_sections);  -- JSONB 검색용
```

**리치 텍스트 포맷팅:**
- `summary_content`: 문서 전체 요약 (TipTap JSON 형식)
- `highlighted_sections`: 강조된 부분들의 배열 (TipTap JSON 형식)
- 슬라이드 요약과 동일한 TipTap JSON 형식 사용
- 사용자가 직접 수정 가능 (WYSIWYG 에디터)

### 5. slide_audio_segments

슬라이드와 음성 파일 구간의 매칭 정보를 저장합니다.

```sql
CREATE TABLE slide_audio_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slide_summary_id uuid NOT NULL REFERENCES slide_summaries(id) ON DELETE CASCADE,
  audio_file_id uuid NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  start_time decimal(10, 2) NOT NULL,  -- 원본 파일 내 시작 시간 (초)
  end_time decimal(10, 2) NOT NULL,  -- 원본 파일 내 종료 시간 (초)
  is_highlight boolean DEFAULT false,  -- 강조 부분 여부
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT slide_audio_segments_time_valid CHECK (end_time > start_time)
);

-- 인덱스
CREATE INDEX idx_slide_audio_slide ON slide_audio_segments(slide_summary_id);
CREATE INDEX idx_slide_audio_file ON slide_audio_segments(audio_file_id);
CREATE INDEX idx_slide_audio_highlight ON slide_audio_segments(is_highlight) WHERE is_highlight = true;
```

### 6. audio_transcripts

STT로 생성된 음성 전사본을 저장합니다. 음성 파일당 1개의 전사본만 존재합니다.

```sql
CREATE TABLE audio_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audio_file_id uuid NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  raw_text text,  -- STT 원문
  refined_text text,  -- 정제된 텍스트
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT audio_transcripts_unique_file UNIQUE(audio_file_id)
);

-- 인덱스
CREATE INDEX idx_audio_transcripts_file ON audio_transcripts(audio_file_id);
```

### 7. folder_summaries

폴더 요약을 저장합니다. 폴더당 1개의 요약만 존재합니다. 리치 텍스트 포맷팅을 지원합니다.

```sql
CREATE TABLE folder_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id uuid NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  summary_content jsonb NOT NULL,  -- 폴더 요약 (TipTap JSON 형식)
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT folder_summaries_unique_folder UNIQUE(folder_id)
);

-- 인덱스
CREATE INDEX idx_folder_summaries_folder ON folder_summaries(folder_id);
CREATE INDEX idx_folder_summaries_summary_content ON folder_summaries USING gin(summary_content);  -- JSONB 검색용
```

**리치 텍스트 포맷팅:**
- `summary_content`: 폴더 내 모든 문서를 종합한 요약 (TipTap JSON 형식)
- 슬라이드 요약, 전체 요약과 동일한 TipTap JSON 형식 사용
- 사용자가 직접 수정 가능 (WYSIWYG 에디터)

### 8. chunks

RAG(Retrieval-Augmented Generation)를 위한 텍스트 청크를 저장합니다.

```sql
CREATE TABLE chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id uuid NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  file_id uuid REFERENCES files(id) ON DELETE CASCADE,
  chunk_text text NOT NULL,
  source_type text,  -- 'pdf', 'audio', 'slide_summary', 'full_summary', 'folder_summary'
  metadata jsonb,  -- page_number, slide_number, time_range 등
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT chunks_text_not_empty CHECK (length(trim(chunk_text)) > 0)
);

-- 인덱스
CREATE INDEX idx_chunks_folder ON chunks(folder_id);
CREATE INDEX idx_chunks_file ON chunks(file_id);
CREATE INDEX idx_chunks_source_type ON chunks(source_type);
CREATE INDEX idx_chunks_metadata ON chunks USING gin(metadata);
```

### 9. chunk_embeddings

벡터 임베딩을 저장합니다. pgvector 확장을 사용합니다.

```sql
-- pgvector 확장 활성화 (마이그레이션에서 처리)
-- CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE chunk_embeddings (
  chunk_id uuid PRIMARY KEY REFERENCES chunks(id) ON DELETE CASCADE,
  embedding vector(768),  -- Gemini Embedding API (text-embedding-004) 차원
  created_at timestamp with time zone DEFAULT now()
);

-- 벡터 검색을 위한 인덱스 (HNSW 또는 IVFFlat)
-- 데이터 양에 따라 선택적으로 생성
-- CREATE INDEX idx_chunk_embeddings_vector ON chunk_embeddings 
--   USING hnsw (embedding vector_cosine_ops);
```

### 10. jobs

비동기 작업 큐를 관리합니다.

```sql
CREATE TABLE jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  type text NOT NULL,  -- 'SLIDE_SUMMARY', 'FULL_SUMMARY', 'FOLDER_SUMMARY', 'STT', 'AUDIO_MATCH', 'EMBEDDING'
  payload jsonb,  -- 작업 데이터
  error_message text,  -- 실패 시 에러 메시지
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  started_at timestamp with time zone,
  completed_at timestamp with time zone
);

-- 인덱스
CREATE INDEX idx_jobs_status ON jobs(status) WHERE status IN ('pending', 'processing');
CREATE INDEX idx_jobs_type ON jobs(type);
CREATE INDEX idx_jobs_created ON jobs(created_at);
```

### 11. qa_logs

질문/답변 기록을 저장합니다.

```sql
CREATE TABLE qa_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,  -- Supabase Auth users.id 참조
  question text NOT NULL,
  answer text NOT NULL,
  sources jsonb,  -- 출처 정보 (chunk_id, file_id, slide_number 등)
  folder_ids uuid[],  -- 검색 범위로 사용된 폴더 ID 배열
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT qa_logs_question_not_empty CHECK (length(trim(question)) > 0),
  CONSTRAINT qa_logs_answer_not_empty CHECK (length(trim(answer)) > 0)
);

-- 인덱스
CREATE INDEX idx_qa_logs_user ON qa_logs(user_id);
CREATE INDEX idx_qa_logs_created ON qa_logs(created_at);
CREATE INDEX idx_qa_logs_folder_ids ON qa_logs USING gin(folder_ids);
```

## 확장 프로그램 (Extensions)

```sql
-- pgvector: 벡터 검색을 위한 확장
CREATE EXTENSION IF NOT EXISTS vector;

-- uuid-ossp: UUID 생성 (이미 기본 제공되지만 명시적으로 활성화)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

## Row Level Security (RLS) 정책

모든 테이블에 RLS를 활성화하고, 사용자는 자신의 데이터만 접근할 수 있도록 설정합니다.

```sql
-- folders
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own folders" ON folders
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own folders" ON folders
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own folders" ON folders
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own folders" ON folders
  FOR DELETE USING (auth.uid() = user_id);

-- files
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own files" ON files
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own files" ON files
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own files" ON files
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own files" ON files
  FOR DELETE USING (auth.uid() = user_id);

-- 나머지 테이블들도 동일한 패턴으로 RLS 정책 생성
-- (실제 구현 시 모든 테이블에 적용)
```

## 트리거 및 함수

### updated_at 자동 업데이트

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- updated_at이 있는 모든 테이블에 트리거 적용
CREATE TRIGGER update_folders_updated_at BEFORE UPDATE ON folders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_slide_summaries_updated_at BEFORE UPDATE ON slide_summaries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_document_full_summaries_updated_at BEFORE UPDATE ON document_full_summaries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_audio_transcripts_updated_at BEFORE UPDATE ON audio_transcripts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_folder_summaries_updated_at BEFORE UPDATE ON folder_summaries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## 관계도

```
folders (트리 구조)
  ├─ files (PDF, Audio)
  │   ├─ slide_summaries (슬라이드별 요약)
  │   │   └─ slide_audio_segments (음성 구간 매칭)
  │   ├─ document_full_summaries (전체 요약)
  │   └─ audio_transcripts (STT 전사본)
  ├─ folder_summaries (폴더 요약)
  └─ chunks (RAG용)
      └─ chunk_embeddings (벡터 임베딩)

jobs (비동기 작업 큐)
qa_logs (질문/답변 기록)
```

## 참고사항

1. **소프트 삭제**: `folders` 테이블에만 `deleted_at` 컬럼이 있습니다. 다른 테이블은 CASCADE 삭제를 사용합니다.

2. **벡터 임베딩 차원**: Gemini Embedding API (text-embedding-004)는 768차원을 사용합니다.

3. **인덱스 전략**: 
   - 자주 조회되는 컬럼에 인덱스 생성
   - 벡터 검색을 위한 HNSW 인덱스는 데이터가 충분히 쌓인 후 생성 권장
   - JSONB 컬럼에는 GIN 인덱스를 사용하여 효율적인 검색 지원

4. **RLS 정책**: 모든 테이블에 RLS를 활성화하여 사용자별 데이터 격리를 보장합니다.

5. **리치 텍스트 포맷팅 (TipTap + JSONB)**:
   - **슬라이드 요약**, **전체 요약**, **폴더 요약** 모두 TipTap JSON 형식으로 저장
   - TipTap은 ProseMirror 기반의 리치 텍스트 에디터
   - JSONB 타입 사용으로 구조화된 데이터 저장 및 효율적인 검색 가능
   - 사용자가 WYSIWYG 에디터로 직접 수정 가능
   - 지원 포맷: 볼드, 이탤릭, 밑줄, 취소선, 색상, 하이라이트, 폰트 크기, 링크, 리스트 등
   - TipTap JSON 형식 예시:
     ```json
     {
       "type": "doc",
       "content": [
         {
           "type": "paragraph",
           "content": [
             {"type": "text", "text": "Hello "},
             {"type": "text", "text": "World", "marks": [{"type": "bold"}]}
           ]
         }
       ]
     }
     ```

