# Aone 프로젝트 아키텍처 문서 (Local Development Prototype)

이 문서는 Supabase 연결을 해제하고 로컬 개발용으로 전환된 Aone의 아키텍처를 설명합니다.

---

## 전체 아키텍처 요약

**Next.js (Frontend & UI) + LocalStorage (Data Mock Layer)**

- **데이터 기반**: 브라우저의 `localStorage`를 메인 데이터 저장소로 사용.
- **인증**: `lib/auth.ts`를 통한 가상 게스트 로그인 (세션은 LocalStorage 상에서 유지).
- **데이터 서비스**: 모든 DB 요청은 `lib/folders.ts`, `lib/files.ts`, `lib/slideSummaries.ts`에서 LocalStorage API를 통해 처리.

---

## 데이터 흐름 파이프라인 (로컬 시뮬레이션)

### 1) 파일 업로드 시뮬레이션
1. 사용자가 PDF/오디오 파일 선택.
2. `lib/files.ts`의 `uploadFile` 호출.
3. 실제 파일 데이터 저장 대신, 가상 스토리지 경로(예: `local/user/root/timestamp-filename.pdf`)를 생성.
4. 파일 메타데이터(이메일, 크기, 이름 등)를 `aone_files` 키로 LocalStorage에 저장.

### 2) 슬라이드 요약 생성 및 편집
1. `lib/slideSummaries.ts`에서 해당 문서 ID의 요약을 LocalStorage(`aone_summaries`)에서 조회.
2. 사용자가 TipTap 에디터로 수정 시 `saveSlideSummary` 호출 → LocalStorage 실시간 업데이트.

---

## 핵심 데이터 저장 구조 (LocalStorage)

| Key | 설명 | 내용 예시 |
| :--- | :--- | :--- |
| `aone_folders` | 폴더 구조 데이터 | `[{ id, name, parent_id, user_id, ... }]` |
| `aone_files` | 파일 메타데이터 | `[{ id, folder_id, storage_path, type, name, ... }]` |
| `aone_summaries` | 슬라이드별 요약/노트 | `[{ id, document_id, slide_number, summary_content, ... }]` |

---

## 프로젝트 폴더 구조

```
/app
  /dashboard               // 대시보드 (LocalStorage 트리 뷰)
  /document/[id]           // 문서 상세 및 로컬 PDF 뷰어
/lib                       // 핵심 비즈니스 로직 (Mock Layer)
  auth.ts                  // 가상 인증 레이어
  folders.ts               // 폴더 관리 서비스
  files.ts                 // 파일 관리 서비스
  slideSummaries.ts        // 요약 관리 서비스
/contexts
  FolderContext.tsx        // 전역 상태 관리 (LocalStorage와 연동)
```

---

## v1 개발 로드맵 (로컬 버전)

1. **폴더 트리 완성**: 생성, 삭제, 이름 변경, 이동 기능 (LocalStorage 기반).
2. **문서 뷰어**: 가상 파일 URL을 통한 PDF 로딩 시뮬레이션.
3. **요약 편집**: 슬라이드별 요약 및 사용자 노트의 영구적 저장(브라우저 내).
4. **휴지통 기능**: 삭제된 항목 보관 및 복구 로직 검증.

---

## 다음 단계 (DB 및 AI 서버 연결 시)

1. `lib/` 폴더 내의 서비스 모듈들을 실제 REST API 또는 SDK 호출로 교체.
2. `middleware.ts` 등에서 실제 세션 쿠키 검증 로직 복구.
3. AI 파이프라인(STT, Gemini 요약)을 위한 서버 사이드 API Routes 연동.
