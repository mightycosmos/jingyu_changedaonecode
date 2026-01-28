추가 설계 고려사항 (Detailed Design Considerations)

이 문서는 FINAL_DESIGN.md와 ARCHITECTURE.md의 핵심 아키텍처를 구현할 때 고려해야 할 상세 설계 사항들을 정리한 것입니다.

⸻

1. 폴더 트리 구조 설계 고려사항

1.1 순환 참조 방지
문제: 폴더 A의 하위에 폴더 B가 있고, 폴더 B를 A의 상위로 이동하면 순환 참조 발생
해결책:
	•	폴더 이동 시 parent_id 변경 전 검증 로직 필수
	•	재귀적 조회: 이동 대상 폴더의 모든 하위 폴더를 조회하여, 이동하려는 위치가 하위 폴더인지 확인
	•	예시 로직:
	```
	function canMoveFolder(folderId, newParentId):
	  if (newParentId == folderId) return false  // 자기 자신을 부모로 지정 불가
	  if (newParentId == null) return true  // 루트로 이동은 항상 가능
	  descendants = getAllDescendants(folderId)  // 모든 하위 폴더 조회
	  if (newParentId in descendants) return false  // 하위 폴더를 부모로 지정 불가
	  return true
	```
	•	DB 제약조건: CHECK 제약조건 또는 트리거로 방어 가능 (복잡하므로 애플리케이션 레벨 검증 권장)

1.2 폴더 삭제 전략
옵션 1: CASCADE 삭제 (하위 폴더와 파일 모두 삭제)
	•	장점: 단순하고 빠름
	•	단점: 실수로 삭제 시 복구 어려움
	•	구현: 
	•	소프트 삭제 (deleted_at 컬럼) 사용 권장
	•	재귀적으로 하위 폴더와 파일들을 deleted_at으로 표시
	•	Storage의 실제 파일은 일정 기간 후 정리 (예: 30일 후)

옵션 2: 상위 폴더로 이동 (하위 폴더와 파일 유지)
	•	장점: 데이터 손실 없음
	•	단점: 사용자가 의도치 않은 구조 변경 가능
	•	구현: parent_id를 삭제 대상 폴더의 parent_id로 변경

권장안: 
	•	기본: CASCADE 삭제 + 소프트 삭제
	•	삭제 확인 다이얼로그에서 "하위 폴더 X개, 파일 Y개가 모두 삭제됩니다" 경고
	•	삭제 취소(복구) 기능 제공 (30일 이내)

1.3 폴더 이동 기능
구현 요구사항:
	•	이동 대상 폴더 선택 (드래그 앤 드롭 또는 선택 메뉴)
	•	새로운 부모 폴더 선택
	•	순환 참조 검증
	•	트랜잭션 처리 (폴더 이동 실패 시 롤백)
	
성능 고려사항:
	•	하위 폴더가 많을 경우 (예: 100개 이상) 재귀 조회가 느려질 수 있음
	•	해결: 
	•	재귀 쿼리 최적화 (WITH RECURSIVE 사용 또는 캐싱)
	•	또는 폴더 경로(path) 컬럼 추가하여 prefix 검색으로 최적화
	•	예: path = '/root/과목A/1주차' 형식으로 저장하여 LIKE 쿼리로 빠르게 조회

1.4 폴더 경로(path) 저장 전략 (선택적 최적화)
문제: parent_id만 사용하면 매번 재귀 조회 필요
해결책: path 컬럼 추가 (예: '/folder1/folder2/folder3')
	•	장점: 
	•	경로 조회가 O(1)
	•	특정 폴더의 모든 하위 폴더 조회가 LIKE 쿼리로 빠름
	•	폴더 이동 시 하위 폴더 path 일괄 업데이트 가능
	•	단점:
	•	폴더 이름 변경 시 모든 하위 폴더 path 업데이트 필요
	•	데이터 중복 (정규화 위반)
	
권장안:
	•	초기 MVP: parent_id만 사용 (단순함)
	•	성능 문제 발생 시 path 컬럼 추가 고려
	•	또는 Materialized Path 패턴 적용 (별도 경로 테이블)

⸻

2. 검색 범위 전략 (RAG Retrieval Scope)

2.1 검색 범위 종류

타입 1: 단일 폴더 검색
	•	설명: 특정 폴더 내에서만 검색
	•	사용 사례: "1주차 강의 자료에서만 검색해줘"
	•	구현:
	```sql
	SELECT * FROM chunks 
	WHERE folder_id = $1 
	ORDER BY embedding <=> $question_embedding 
	LIMIT k;
	```

타입 2: 다중 폴더 검색
	•	설명: 사용자가 선택한 여러 폴더 내에서 검색
	•	사용 사례: "중간고사 범위(3주차, 4주차, 5주차)에서 검색해줘"
	•	구현:
	```sql
	SELECT * FROM chunks 
	WHERE folder_id = ANY($folder_ids::uuid[])
	ORDER BY embedding <=> $question_embedding 
	LIMIT k;
	```

타입 3: 전체 검색
	•	설명: 모든 폴더에서 검색
	•	사용 사례: "전체 자료에서 이 개념 찾아줘"
	•	구현:
	```sql
	SELECT * FROM chunks 
	WHERE user_id = $user_id  -- 또는 인덱스 최적화를 위해 별도 필터
	ORDER BY embedding <=> $question_embedding 
	LIMIT k;
	```

타입 4: 하위 폴더 포함 검색
	•	설명: 선택한 폴더 + 모든 하위 폴더 포함
	•	사용 사례: "과목A 폴더와 그 하위 모든 폴더에서 검색"
	•	구현:
	```sql
	WITH folder_tree AS (
	  SELECT id FROM folders 
	  WHERE id = $folder_id
	  UNION ALL
	  SELECT f.id FROM folders f
	  INNER JOIN folder_tree ft ON f.parent_id = ft.id
	)
	SELECT * FROM chunks c
	INNER JOIN folder_tree ft ON c.folder_id = ft.id
	ORDER BY c.embedding <=> $question_embedding 
	LIMIT k;
	```

2.2 검색 범위 UI/UX 설계
기본 검색 모드:
	•	전체 검색 (기본값)
	•	현재 폴더 검색 (폴더 상세 페이지에서 검색 시)
	
고급 검색 옵션:
	•	폴더 선택 다이얼로그: 체크박스로 여러 폴더 선택
	•	"하위 폴더 포함" 체크박스
	•	검색 범위 표시: "검색 범위: 과목A > 1주차, 2주차, 3주차 (3개 폴더)"

2.3 검색 성능 최적화
인덱스 전략:
	•	chunks 테이블: (folder_id, embedding) 복합 인덱스
	•	pgvector 인덱스: ivfflat 또는 hnsw (데이터 양에 따라)
	•	예상 쿼리 패턴에 맞춰 인덱스 설계

캐싱 전략:
	•	자주 검색되는 폴더 조합의 결과 캐싱 (Redis 등)
	•	하위 폴더 트리 구조 캐싱 (폴더 구조 변경 시만 무효화)

⸻

3. 요약 캐싱 전략 (Summary Caching Strategy)

3.1 요약 계층 구조
```
슬라이드별 요약 (각 슬라이드마다)
    ↓
전체 요약 (문서 전체, 슬라이드별 요약 + 교수님 음성)
    ↓
폴더 요약 (폴더 내 모든 문서의 요약 종합)
```

3.2 요약 재생성 전략

**슬라이드별 요약:**
- PDF 업로드 시 즉시 자동 생성 (Proactive)
- 사용자가 수정 가능 (자동 저장)
- 수정 시 해당 슬라이드만 업데이트

**전체 요약:**
- 사용자가 "전체요약하기" 버튼 클릭 시에만 생성 (Lazy)
- 슬라이드별 요약 수정 후에도 자동 업데이트 안 함
- 사용자가 명시적으로 다시 클릭해야 반영

**폴더 요약:**
- 사용자가 "폴더 요약하기" 버튼 클릭 시에만 생성 (Lazy)
- 새 문서 추가 시 자동 무효화 없음
- 사용자가 명시적으로 다시 클릭해야 재생성

**권장안:**
- 슬라이드별 요약: Proactive (업로드 시 즉시 생성)
- 전체 요약: Lazy (사용자 명시적 요청)
- 폴더 요약: Lazy (사용자 명시적 요청)

3.3 요약 생성 비용 최적화

**슬라이드별 요약:**
- 각 슬라이드를 개별적으로 요약 생성
- 비동기 처리로 점진적 로딩
- Gemini Flash 사용 (비용 최적화)

**전체 요약:**
- 슬라이드별 요약 + 교수님 설명 텍스트를 종합
- 가중치 적용: 교수님 말씀 70%, 슬라이드 요약 30%
- Gemini Flash 사용

**폴더 요약:**
- 여러 문서의 요약을 한 번에 생성 (Gemini Flash의 긴 컨텍스트 활용)
- 배치 처리로 비용 절감

3.4 요약 버전 관리 (선택적, v2)

목적: 요약이 변경되었을 때 이전 버전과 비교하여 "무엇이 바뀌었는지" 표시
구현:
	•	요약 테이블에 version 컬럼 추가
	•	요약 재생성 시 version 증가
	•	이전 버전 저장 (별도 테이블 또는 JSONB 컬럼)
	•	UI에서 "최근 업데이트됨" 표시 또는 diff 보기 기능

비용 고려: 저장 공간 증가하므로 MVP 이후 고려

⸻

4. 추가 구현 고려사항

4.1 폴더 권한 및 공유 (향후 기능)
	•	폴더별 공유 설정 (비공개/링크 공유/특정 사용자 공유)
	•	공유된 폴더의 자료를 다른 사용자가 검색/질문할 수 있는지 설정
	•	현재는 MVP에서 제외해도 됨

4.2 폴더 메타데이터
	•	설명(description): 폴더 설명 추가 (검색/필터링에 활용 가능)
	•	태그(tags): 폴더에 태그 추가 (예: "중간고사", "기말고사")
	•	색상(color): 폴더별 색상 지정 (시각적 구분)
	•	정렬 순서(order): 폴더 순서 지정

4.3 폴더 검색 및 필터링
	•	폴더 이름으로 검색
	•	최근 수정일 기준 정렬
	•	파일 개수 기준 정렬
	•	태그로 필터링

4.4 대량 파일 처리
	•	폴더에 100개 이상 파일 업로드 시 성능 고려
	•	배치 처리: 여러 파일을 한 번에 업로드해도 순차적으로 처리
	•	진행 상황 표시: "처리 중: 5/100"

