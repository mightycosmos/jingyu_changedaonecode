# 최종 설계 문서 (Final Design Document)

이 문서는 Aone 프로젝트의 최종 설계 사항을 상세히 정리한 것입니다.

---

## 목차

1. [전체 구조 개요](#1-전체-구조-개요)
2. [폴더 시스템](#2-폴더-시스템)
3. [문서 요약 시스템](#3-문서-요약-시스템)
4. [폴더 요약 시스템](#4-폴더-요약-시스템)
5. [녹음 및 음성 처리](#5-녹음-및-음성-처리)
6. [UI/UX 플로우](#6-uiux-플로우)
7. [데이터베이스 구조](#7-데이터베이스-구조)
8. [기술 구현 세부사항](#8-기술-구현-세부사항)

---

## 1. 전체 구조 개요

### 1.1 핵심 개념

**계층 구조:**
```
폴더 (트리 구조)
  └─ 문서 (PDF/PPT)
      ├─ 슬라이드별 요약 (N개)
      └─ 전체 요약 (1개)
  └─ 하위 폴더
      └─ 문서들...
```

**요약 타입:**
- **문서 요약**: 슬라이드별 요약 + 전체 요약
- **폴더 요약**: 폴더 내 모든 문서의 요약을 종합한 요약 (폴더당 1개)

### 1.2 핵심 원칙

1. **사용자 자유도**: 고정된 과목/주차 구조 없이 자유로운 폴더 트리 구조
2. **계층적 요약**: 문서 요약 → 폴더 요약으로 이어지는 계층 구조
3. **점진적 생성**: 요약 생성 중에도 내용을 볼 수 있음
4. **사용자 수정 가능**: 모든 요약은 사용자가 직접 수정 가능

---

## 2. 폴더 시스템

### 2.1 폴더 구조

**특징:**
- 자유로운 폴더 트리 구조 (parent_id 기반)
- 폴더 생성, 삭제, 이름 변경, 이동 지원
- 하위 폴더 무제한 생성 가능

**제약사항:**
- 순환 참조 방지 (자기 자신을 부모로 지정 불가, 하위 폴더를 부모로 지정 불가)
- 폴더 삭제 시 CASCADE 삭제 + 소프트 삭제 (30일 후 영구 삭제)

### 2.2 폴더 요약

**기본 규칙:**
- 폴더당 요약본 1개로 고정
- 하위에 문서가 최소 1개 이상 있어야 요약 생성 가능
- 하위에 빈 폴더만 있어도 요약 버튼 비활성화

**요약 생성 로직:**
1. 하위 폴더/문서 조회 (재귀적)
2. 각 항목의 요약 텍스트 수집:
   - 폴더: 폴더 요약이 있으면 그것 사용, 없으면 하위 문서 요약 사용 (재귀적)
   - 문서: 전체 요약이 있으면 전체 요약, 없으면 슬라이드별 요약 합치기
3. 수집된 텍스트들을 종합하여 폴더 요약 생성

**업데이트:**
- 사용자가 명시적으로 "요약하기" 버튼 클릭 시에만 재생성
- 자동 무효화 없음 (기존 요약 유지)

### 2.3 폴더 요약 UI

**문서/폴더 선택:**
- 좌측 사이드바의 폴더 구조처럼 트리 구조로 표시
- 기본적으로 모든 항목 선택됨 (체크박스)
- 사용자가 선택/해제 가능

---

## 3. 문서 요약 시스템

### 3.1 문서 요약 구조

**문서당 두 가지 요약 방식:**

1. **슬라이드별 요약**
   - 각 슬라이드(페이지)마다 개별 요약
   - AI 자동 생성 + 사용자 수정 가능
   - DB에 별도 레코드로 저장 (slide_summaries 테이블)

2. **전체 요약**
   - 문서 전체를 종합한 1개의 요약
   - 슬라이드별 요약 + 교수님 음성 녹음본을 바탕으로 생성
   - DB에 1개 레코드로 저장 (document_full_summaries 테이블)

### 3.2 슬라이드별 요약

**생성 시점:**
- PDF 업로드 즉시 자동 생성 시작
- 각 슬라이드를 개별적으로 RAG로 요약 생성
- 생성 중에도 PDF는 볼 수 있음 (점진적 로딩)

**특징:**
- 슬라이드별로 독립적인 요약
- 사용자가 직접 수정/추가 가능
- 자동 저장 (Debounce 2-3초)
- Ctrl+Z (되돌리기) 지원

**저장 구조:**
- DB에 별도 레코드로 저장 (슬라이드 개수만큼)
- 각 슬라이드별로 수정 시 해당 레코드만 업데이트

**UI 구조:**
```
[슬라이드 번호 및 제목]
[슬라이드별 요약 텍스트] (수정 가능)

[교수님 설명 ▼] (접었다 펼 수 있음)
  - 정제된 교수님 설명 텍스트
  - 타임스탬프
  - 음성 재생 버튼
```

### 3.3 전체 요약

**생성 시점:**
- 사용자가 "전체요약하기" 버튼 클릭 시
- 슬라이드별 요약 수정 후에도 다시 클릭해야 반영 (자동 업데이트 아님)

**생성 로직:**
1. 슬라이드별 요약 수집 (AI 요약 + 사용자 수정 내용 포함)
2. 녹음 파일이 있으면:
   - 녹음 파일 STT 처리
   - 정제된 교수님 설명 텍스트 생성
   - 가중치 적용: 교수님 말씀 70%, 슬라이드 요약 30%
3. 녹음 파일이 없으면:
   - 슬라이드별 요약만으로 생성
   - 알림 표시: "녹음 파일이 없습니다. 슬라이드별 요약만으로 생성됩니다."

**가중치 적용 방식:**
- Gemini API에 가중치를 명시하여 요약 생성
- 교수님 설명을 70% 가중치로 더 많이 반영
- 강조된 부분은 특별히 명시

**강조 표시:**
- 강조된 부분은 배경색(#ffeb3b) + 밑줄로 표시
- 기존 강조 정보는 DB에 저장되어 재생성 시에도 활용
- 새로운 강조 부분이 발견되면 추가

**UI 표시:**
- Univ 스타일의 전체 요약 화면
- 참조 버튼: 클릭 시 좌측 PDF 슬라이드로 스크롤 이동
- 여러 슬라이드 참조 시 여러 버튼 일렬로 나열

### 3.4 요약 생성 방식

**슬라이드별 요약 초기 생성:**
- PDF 업로드 시 각 슬라이드를 개별적으로 RAG로 요약
- Gemini Flash 사용 (비용 최적화)

**전체 요약 생성:**
- 슬라이드별 요약 + 교수님 설명 텍스트를 종합
- Gemini Flash 사용
- 프롬프트에 가중치 명시

---

## 4. 폴더 요약 시스템

### 4.1 폴더 요약 생성

**조건:**
- 하위에 문서가 최소 1개 이상 있어야 함
- 빈 폴더(하위에 폴더만 있고 문서 없음)는 요약 불가

**생성 플로우:**
1. 사용자가 "폴더 요약하기" 버튼 클릭
2. 문서/폴더 선택 화면 (기본 모두 선택)
3. 선택된 항목들의 요약 텍스트 수집:
   - 폴더: 폴더 요약 우선, 없으면 하위 문서 요약 (재귀적)
   - 문서: 전체 요약 우선, 없으면 슬라이드별 요약 합치기
4. 수집된 텍스트들을 종합하여 폴더 요약 생성

**업데이트:**
- 새 문서 추가 시 자동 무효화 없음
- 사용자가 "요약하기" 버튼 다시 클릭 시 재생성
- 기존 요약은 그대로 유지

### 4.2 폴더 요약 사용처

**폴더 요약이 사용되는 경우:**
- 상위 폴더의 요약 생성 시
- 다른 폴더 요약에서 하위 폴더 포함 시

---

## 5. 녹음 및 음성 처리

### 5.1 녹음 기능

**녹음 위치:**
- 슬라이드별 요약 화면 우측 상단
- Univ 스타일 탭 구조에서 "녹음" 탭

**녹음 제한:**
- 최대 90분 (85분 경고 표시, 90분 도달 시 자동 중지)
- 여러 번 녹음 가능 (쉬는시간, 퀴즈시간 대비)

**녹음 완료:**
- "녹음 완료" 버튼 클릭 시
- 녹음 파일 목록 표시:
  - 파일명: "녹음파일 1", "녹음파일 2", ... (수정 가능)
  - 길이, 시간 표시
  - 미리듣기 기능

### 5.2 녹음 파일 처리

**저장 방식:**
- 원본 파일 유지 + 타임스탬프 저장 (슬라이드별 매칭 정보)
- 파일을 잘라서 저장하지 않음 (용량 절약)

**슬라이드 매칭:**
1. 타임스탬프 기반 대략적인 구간 추정
   - 녹음 시간을 슬라이드 개수로 나눠서 구간 추정
2. RAG로 정확한 구간 찾기
   - 각 추정 구간 내에서 슬라이드 내용과 가장 유사한 부분 찾기
3. 슬라이드 순서대로 매칭 (시간순 선형)
4. 매칭되지 않은 구간은 제외

**매칭 결과 저장:**
```sql
slide_audio_segments 테이블:
- slide_summary_id: 슬라이드 요약 ID
- audio_file_id: 원본 녹음 파일 ID
- start_time: 원본 파일 내 시작 시간
- end_time: 원본 파일 내 종료 시간
- is_highlight: 강조 부분 여부
```

### 5.3 강조 부분 처리

**강조 감지:**
- 이미 슬라이드에 연결된 구간과 유사한 내용을 다시 말한 경우
- → 강조로 판단

**강조 표시:**
- 슬라이드별 요약에서 "강조된 설명" 별도 섹션으로 표시
- 전체 요약에서 강조 부분은 배경색 + 밑줄로 표시

**강조 정보 저장:**
- DB에 is_highlight 플래그로 저장
- 전체 요약 재생성 시 기존 강조 정보 활용 + 새로운 강조 추가

### 5.4 전체요약하기 시 녹음 처리

**플로우:**
1. 사용자가 선택한 녹음 파일들 STT 처리
2. 정제된 교수님 설명 텍스트 생성
   - 말더듬 제거
   - 문장 정리
   - 교수님 말씀만 추출 (학생 질문 등 제외)
3. 슬라이드별 요약 + 정제된 교수님 설명으로 전체 요약 생성
   - 가중치: 교수님 말씀 70%, 슬라이드 요약 30%

**녹음 파일 선택:**
- "전체요약하기" 버튼 클릭 전에 녹음 파일 선택
- 선택된 파일만 STT 처리 및 요약에 포함
- 선택되지 않은 파일은 소프트 삭제 (30일 후 영구 삭제)

**녹음 파일 없을 때:**
- 슬라이드별 요약만으로 전체 요약 생성
- 알림 표시: "녹음 파일이 없습니다. 슬라이드별 요약만으로 생성됩니다."

### 5.5 음성 재생

**슬라이드별 요약:**
- 각 슬라이드별로 독립적인 음성 재생 가능
- "교수님 설명" 토글 클릭 시 해당 슬라이드의 음성 구간 재생
- 하단 재생 바와 연동

**전체 요약:**
- 음성 파일 재생 없음
- 정제된 교수님 설명 텍스트만 토글로 표시

**하단 재생 바:**
- 슬라이드별 요약 화면 하단에 항상 표시
- 전체 녹음 파일 재생 가능
- 슬라이드별 음성 재생 시 해당 구간으로 이동

---

## 6. UI/UX 플로우

### 6.1 파일 업로드 및 슬라이드별 요약 생성

**플로우:**
1. 사용자가 PDF 파일 업로드
2. 업로드 완료 후 슬라이드별 요약 화면으로 자동 이동
3. 좌측: PDF 슬라이드 표시 (즉시 볼 수 있음)
4. 우측: 슬라이드별 요약 (점진적 로딩)
   - 요약 생성 중: "요약 생성 중... (3/48)" 표시
   - 생성 완료된 슬라이드부터 표시
   - 생성 중인 슬라이드도 볼 수 있음

### 6.2 슬라이드별 요약 수정

**기능:**
- 모든 슬라이드별 요약은 수정 가능
- 자동 저장 (Debounce 2-3초)
- Ctrl+Z (되돌리기) 지원
- 수정 내용은 즉시 DB에 반영

**저장 방식:**
- 수정된 슬라이드만 업데이트 (Diff 기반)

### 6.3 수업 중 사용

**시나리오:**
1. 수업 전: PDF 업로드하여 슬라이드별 요약 확인
2. 수업 중:
   - 슬라이드별 요약에 필기 추가/수정
   - 우측 상단 "녹음하기" 버튼으로 교수님 음성 녹음
   - 여러 번 녹음 가능 (쉬는시간, 퀴즈시간 대비)
3. 수업 종료:
   - "녹음 완료" 버튼 클릭
   - 녹음 파일 목록에서 선택
   - 선택된 녹음 파일들이 슬라이드별로 매칭되어 저장

### 6.4 전체 요약 생성

**플로우:**
1. Univ 스타일 탭 구조에서 "전체 요약" 탭 클릭
2. "전체요약하기" 버튼 클릭
3. 녹음 파일 선택 (있으면)
4. STT 처리 + 정제 + 전체 요약 생성
5. 생성 완료 후 전체 요약 표시

**전체 요약 UI:**
- Univ 스타일의 전체 요약 화면
- 좌측: PDF 슬라이드
- 우측: 전체 요약 텍스트
- 참조 버튼: 클릭 시 좌측 PDF 슬라이드로 스크롤 이동

### 6.5 슬라이드별 요약 ↔ 전체 요약 전환

**탭 구조:**
- "슬라이드별 요약" 탭
- "전체 요약" 탭
- "녹음" 탭

**전환:**
- 탭 클릭으로 자유롭게 전환 가능
- 각 탭에서 독립적으로 작업 가능

### 6.6 폴더 요약 생성

**플로우:**
1. 폴더 상세 페이지에서 "폴더 요약하기" 버튼 클릭
2. 문서/폴더 선택 화면:
   - 폴더 트리 구조로 표시
   - 기본적으로 모든 항목 선택됨
   - 사용자가 선택/해제 가능
3. "요약하기" 버튼 클릭
4. 폴더 요약 생성 완료

**업데이트:**
- 새 문서 추가 시 기존 요약 유지
- 사용자가 "요약하기" 버튼 다시 클릭 시 재생성

---

## 7. 데이터베이스 구조

### 7.1 핵심 테이블

#### folders
```sql
CREATE TABLE folders (
  id uuid PRIMARY KEY,
  parent_id uuid REFERENCES folders(id),  -- NULL이면 루트
  name text NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  deleted_at timestamp  -- 소프트 삭제
);
```

#### files
```sql
CREATE TABLE files (
  id uuid PRIMARY KEY,
  folder_id uuid REFERENCES folders(id),
  type text NOT NULL,  -- 'pdf', 'audio'
  storage_path text NOT NULL,
  name text NOT NULL,
  size bigint,  -- 파일 크기 (bytes)
  duration integer,  -- 음성 파일 길이 (초)
  page_count integer,  -- PDF 페이지 수
  created_at timestamp DEFAULT now()
);
```

#### slide_summaries
```sql
CREATE TABLE slide_summaries (
  id uuid PRIMARY KEY,
  document_id uuid REFERENCES files(id),  -- PDF 파일 ID
  slide_number integer NOT NULL,
  summary_text text,  -- AI 생성 요약
  user_notes text,  -- 사용자 추가 정리
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  UNIQUE(document_id, slide_number)
);

CREATE INDEX idx_slide_summaries_doc ON slide_summaries(document_id);
```

#### document_full_summaries
```sql
CREATE TABLE document_full_summaries (
  id uuid PRIMARY KEY,
  document_id uuid REFERENCES files(id),
  summary_text text NOT NULL,
  highlighted_text text,  -- 강조된 부분 (JSON 또는 텍스트)
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  UNIQUE(document_id)
);
```

#### slide_audio_segments
```sql
CREATE TABLE slide_audio_segments (
  id uuid PRIMARY KEY,
  slide_summary_id uuid REFERENCES slide_summaries(id),
  audio_file_id uuid REFERENCES files(id),  -- 원본 녹음 파일
  start_time decimal NOT NULL,  -- 원본 파일 내 시작 시간 (초)
  end_time decimal NOT NULL,  -- 원본 파일 내 종료 시간 (초)
  is_highlight boolean DEFAULT false,  -- 강조 부분 여부
  created_at timestamp DEFAULT now()
);

CREATE INDEX idx_slide_audio_slide ON slide_audio_segments(slide_summary_id);
CREATE INDEX idx_slide_audio_file ON slide_audio_segments(audio_file_id);
```

#### audio_transcripts
```sql
CREATE TABLE audio_transcripts (
  id uuid PRIMARY KEY,
  audio_file_id uuid REFERENCES files(id),
  raw_text text,  -- STT 원문
  refined_text text,  -- 정제된 텍스트
  created_at timestamp DEFAULT now(),
  UNIQUE(audio_file_id)
);
```

#### folder_summaries
```sql
CREATE TABLE folder_summaries (
  id uuid PRIMARY KEY,
  folder_id uuid REFERENCES folders(id),
  summary_text text NOT NULL,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  UNIQUE(folder_id)
);
```

#### chunks (RAG용)
```sql
CREATE TABLE chunks (
  id uuid PRIMARY KEY,
  folder_id uuid REFERENCES folders(id),
  file_id uuid REFERENCES files(id),
  chunk_text text NOT NULL,
  source_type text,  -- 'pdf', 'audio', 'slide_summary', 'full_summary'
  metadata jsonb,  -- page_number, slide_number, time_range 등
  created_at timestamp DEFAULT now()
);

CREATE TABLE chunk_embeddings (
  chunk_id uuid PRIMARY KEY REFERENCES chunks(id),
  embedding vector(768),  -- Gemini Embedding API (text-embedding-004)
  created_at timestamp DEFAULT now()
);
```

### 7.2 관계도

```
folders (트리 구조)
  ├─ files (PDF, Audio)
  │   ├─ slide_summaries (슬라이드별 요약)
  │   │   └─ slide_audio_segments (음성 구간 매칭)
  │   ├─ document_full_summaries (전체 요약)
  │   └─ audio_transcripts (STT 전사본)
  └─ folder_summaries (폴더 요약)

chunks (RAG용)
  └─ chunk_embeddings (벡터 임베딩)
```

---

## 8. 기술 구현 세부사항

### 8.1 슬라이드별 요약 생성

**프로세스:**
1. PDF 업로드 → 파일 파싱 (페이지별 분리)
2. 각 페이지를 이미지로 변환
3. Gemini Flash로 각 슬라이드별 개별 요약 생성
4. DB에 slide_summaries 레코드로 저장
5. 생성 완료된 슬라이드부터 UI에 표시 (점진적 로딩)

**API 호출:**
- 각 슬라이드마다 별도 API 호출
- 비동기 처리 (Job 큐 활용)

### 8.2 녹음 파일 STT 처리

**프로세스:**
1. 사용자가 선택한 녹음 파일들 STT 처리 (Google Cloud Speech-to-Text API)
   - 한국어 인식 최적화 설정
   - 실시간 또는 배치 전사 지원
2. 전사본 정제:
   - 말더듬 제거
   - 문장 정리
   - 교수님 말씀만 추출
3. audio_transcripts 테이블에 저장

### 8.3 슬라이드-음성 매칭

**알고리즘:**
1. 타임스탬프 기반 구간 추정
   ```typescript
   const estimatedDuration = audioFile.duration / slideCount;
   const estimatedRanges = slides.map((slide, index) => ({
     start: index * estimatedDuration,
     end: (index + 1) * estimatedDuration
   }));
   ```

2. RAG로 정확한 구간 찾기
   ```typescript
   for (const slide of slides) {
     const matchedSegment = await findBestMatch(
       slide.summary_text + slide.user_notes,
       audioTranscript,
       estimatedRange.start,
       estimatedRange.end
     );
     
     await createSlideAudioSegment({
       slide_summary_id: slide.id,
       audio_file_id: audioFile.id,
       start_time: matchedSegment.start_time,
       end_time: matchedSegment.end_time
     });
   }
   ```

3. 강조 부분 감지
   ```typescript
   // 이미 매칭된 슬라이드와 유사한 내용 발견 시
   const existingSlide = await findSimilarSlide(audioSegment);
   if (existingSlide) {
     await createSlideAudioSegment({
       ...audioSegment,
       is_highlight: true
     });
   }
   ```

### 8.4 전체 요약 생성

**프로세스:**
1. 슬라이드별 요약 수집
   ```typescript
   const slideSummaries = slideSummaries
     .map(s => s.summary_text + (s.user_notes ? '\n' + s.user_notes : ''))
     .join('\n\n');
   ```

2. 교수님 설명 텍스트 수집 (있으면)
   ```typescript
   const professorText = audioTranscripts
     .map(t => t.refined_text)
     .join('\n\n');
   ```

3. Gemini API로 전체 요약 생성
   ```typescript
   const prompt = `
   다음 두 가지 자료를 바탕으로 전체 요약을 작성해주세요.
   
   [슬라이드별 요약] (가중치: 30%)
   ${slideSummaryText}
   
   [교수님 설명] (가중치: 70%, 특히 강조된 부분 중시)
   ${professorSummaryText}
   강조된 부분: ${highlights.map(h => h.text).join('\n')}
   
   요약 시 다음을 지켜주세요:
   1. 교수님 설명을 70% 가중치로 더 많이 반영
   2. 강조된 부분은 특별히 명시
   3. 슬라이드별 요약은 보조적으로 활용
   `;
   
   const summary = await gemini.generate(prompt);
   ```

4. 강조 부분 마크업 적용
   ```typescript
   const highlightedSummary = applyHighlighting(summary, highlights);
   ```

5. DB에 저장

### 8.5 폴더 요약 생성

**프로세스:**
1. 선택된 폴더/문서 재귀적으로 조회
2. 각 항목의 요약 텍스트 수집:
   ```typescript
   function getSummaryText(item) {
     if (item.type === 'folder') {
       const folderSummary = await getFolderSummary(item.id);
       if (folderSummary) {
         return folderSummary.summary_text;
       } else {
         // 하위 문서 요약 재귀적으로 가져오기
         return getChildDocumentSummaries(item.id);
       }
     } else {
       const docSummary = await getDocumentSummary(item.id);
       if (docSummary?.full_summary) {
         return docSummary.full_summary;
       } else {
         // 슬라이드별 요약 합치기
         return combineSlideSummaries(item.id);
       }
     }
   }
   ```

3. 수집된 텍스트들을 Gemini로 종합하여 폴더 요약 생성

### 8.6 자동 저장

**구현:**
```typescript
const debouncedSave = useMemo(
  () => debounce(async (slideId, content) => {
    try {
      await updateSlideSummary(slideId, { content });
      showSaveIndicator('저장됨');
    } catch (error) {
      showSaveIndicator('저장 실패 - 재시도 중...');
    }
  }, 2000),
  []
);

// 입력 시
onChange={(content) => {
  setContent(content);
  debouncedSave(slideId, content);
}}
```

**되돌리기 (Ctrl+Z):**
```typescript
const [history, setHistory] = useState<string[]>([]);
const [historyIndex, setHistoryIndex] = useState(-1);

const handleChange = (content: string) => {
  const newHistory = history.slice(0, historyIndex + 1);
  newHistory.push(content);
  setHistory(newHistory);
  setHistoryIndex(newHistory.length - 1);
  debouncedSave(slideId, content);
};

const handleUndo = () => {
  if (historyIndex > 0) {
    setHistoryIndex(historyIndex - 1);
    setContent(history[historyIndex - 1]);
  }
};

onKeyDown={(e) => {
  if (e.ctrlKey && e.key === 'z') {
    e.preventDefault();
    handleUndo();
  }
}}
```

### 8.7 음성 재생

**구현:**
```typescript
// 슬라이드별 음성 재생
const playSlideAudio = async (slideId: string) => {
  const audioSegment = await getSlideAudioSegment(slideId);
  if (audioSegment) {
    // 하단 재생 바에 해당 구간 재생 요청
    bottomPlayerRef.current?.play({
      fileId: audioSegment.audio_file_id,
      startTime: audioSegment.start_time,
      endTime: audioSegment.end_time
    });
  }
};
```

---

## 9. 벤치마킹 (Univ.co.kr)

### 9.1 유사점

- 좌측 PDF, 우측 요약 구조
- 슬라이드별 요약 및 전체 요약 제공
- 요약 생성 방식 (RAG 기반)

### 9.2 차이점

1. **폴더 구조**
   - Univ: 문서 단위 요약만 제공
   - 본 프로젝트: 자유로운 폴더 구조 + 폴더 요약

2. **파일 이동**
   - Univ: 폴더 내에서만 상위폴더로 이동 가능
   - 본 프로젝트: 좌측 사이드바에서 드래그 앤 드롭으로 자유롭게 이동

3. **녹음 통합**
   - Univ: 없음
   - 본 프로젝트: 녹음 파일과 요약 통합

4. **요약 수정**
   - Univ: 요약 수정 불가 (추정)
   - 본 프로젝트: 모든 요약 수정 가능

---

## 10. 구현 우선순위 (MVP)

### v1 (2~3주 MVP)

**필수 기능:**
1. 폴더 트리 구조 (생성/삭제/이름 변경/이동)
2. PDF 업로드 및 슬라이드별 요약 자동 생성
3. 슬라이드별 요약 수정 (자동 저장, Ctrl+Z)
4. 녹음 기능 (녹음, 완료, 파일 선택)
5. 슬라이드-음성 매칭
6. 전체 요약 생성 (가중치 적용)
7. 폴더 요약 생성
8. 기본 UI (좌측 PDF, 우측 요약)

### v1.5

**추가 기능:**
1. 강조 부분 감지 및 표시
2. 전체 요약에서 강조 부분 하이라이트
3. 참조 버튼 기능 (슬라이드로 이동)
4. 폴더 요약 선택 UI 개선

### v2

**고도화 기능:**
1. 화자 분리 (교수/학생)
2. 퀴즈 생성
3. 오답노트
4. 요약 버전 관리 (히스토리)

---

## 11. 주의사항 및 고려사항

### 11.1 성능

- 슬라이드별 요약 생성은 비동기 처리 (Job 큐)
- 점진적 로딩으로 사용자 경험 개선
- 자동 저장 Debounce로 API 호출 최소화

### 11.2 용량 관리

- 녹음 파일: 원본 파일만 저장 (타임스탬프로 구간 관리)
- 선택되지 않은 녹음 파일: 소프트 삭제 후 30일 후 영구 삭제
- Storage 용량 모니터링 필요

### 11.3 비용 관리

- Gemini Flash 사용 (비용 최적화)
- 요약 캐싱으로 재생성 방지
- 폴더 요약은 사용자가 명시적으로 재생성

### 11.4 데이터 일관성

- 슬라이드별 요약 수정 시 전체 요약 자동 업데이트 안 함
- 사용자가 명시적으로 "전체요약하기" 다시 클릭해야 반영
- 폴더 요약도 마찬가지로 명시적 재생성

---

## 12. 향후 개선 사항

1. **요약 버전 관리**
   - 수정 히스토리 저장
   - 이전 버전 비교 기능

2. **공유 기능**
   - 폴더/문서 공유
   - 협업 기능

3. **검색 기능**
   - RAG 기반 질문 답변
   - 폴더/문서 검색

4. **통계 및 분석**
   - 학습 진행도
   - 요약 품질 분석

---

이 문서는 프로젝트 구현의 기준이 됩니다. 구현 중 변경 사항이 발생하면 이 문서를 업데이트해주세요.

