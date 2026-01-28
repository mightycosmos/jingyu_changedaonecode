# Aone 프로젝트 기술 스택 문서 (Local Development Prototype)

## 프로젝트 개요

**프로젝트명**: Aone  
**설명**: 강의 녹음과 자료를 자유롭게 정리하는 AI 학습 파트너 웹 서비스 (로컬 개발용 프로토타입)

---

## 기술 스택 구성

### 프론트엔드

**Next.js 14+ (App Router)**
- React 기반 프레임워크
- 서버 컴포넌트 및 클라이언트 컴포넌트 활용

**Tailwind CSS**
- 유틸리티 기반 CSS 프레임워크

**언어**: TypeScript

---

### 데이터 레이어 (로컬 프로토타입)

**LocalStorage / IndexedDB (Mock)**
- 현재 모든 데이터(폴더, 파일 메타데이터, 요약)는 브라우저의 `localStorage`에 저장됨.
- `lib/folders.ts`, `lib/files.ts`, `lib/slideSummaries.ts`에서 로컬 저장소 로직을 담당함.

**인증 (Mock Auth)**
- `lib/auth.ts`를 통해 가상 로그인 구현.
- 기본적으로 "Guest User"로 자동 세션 유지.

---

### 인프라

**Vercel (프론트엔드 배포)**
- Next.js 최적화 배포
- 자동 CI/CD

---

## 프로젝트 구조

```
aone/
├── app/                         # Next.js App Router
│   ├── (auth)/
│   │   ├── login/
│   │   └── signup/
│   ├── dashboard/
│   ├── document/
│   └── layout.tsx
│
├── components/
│   ├── ui/
│   ├── folders/
│   ├── files/
│   └── document/
│
├── lib/                         # 핵심 비즈니스 로직 및 데이터 Mock Layer
│   ├── auth.ts                  # Mock Authentication
│   ├── folders.ts               # LocalStorage Folder/File CRUD
│   ├── files.ts                 # LocalStorage File Metadata & Mock Storage
│   └── slideSummaries.ts        # LocalStorage Slide summaries
│
├── contexts/
│   └── FolderContext.tsx        # 폴더/파일 상태 전역 관리
│
├── package.json
└── tailwind.config.ts
```

---

## 주요 상태 및 저장 키 (LocalStorage)

1. `aone_folders`: 폴더 트리 정보 저장
2. `aone_files`: 파일 메타데이터 저장
3. `aone_summaries`: 슬라이드별 요약 데이터 저장

---

## 다음 단계 (DB 연결 시)

1. `lib/` 폴더 내의 각 서비스 파일들을 실제 서버 API 호출 방식으로 변경.
2. `lib/auth.ts`를 사용자의 자체 인증 서버 또는 다른 BaaS(Supabase, Firebase 등)로 교체.
3. 실제 파일 스토리지를 S3 또는 유사 인프라로 연결.
