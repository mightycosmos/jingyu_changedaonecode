-- files 테이블에 deleted_at 컬럼 추가
-- 문서를 휴지통에 저장하기 위한 소프트 삭제 기능

ALTER TABLE files 
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

-- 인덱스 추가 (삭제되지 않은 파일 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_files_deleted ON files(deleted_at) WHERE deleted_at IS NULL;

-- 기존 데이터는 deleted_at이 null이므로 문제없음
-- 이 마이그레이션은 기존 데이터에 영향을 주지 않습니다.

