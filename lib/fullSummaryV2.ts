import { FullSummaryV2 } from '@/types/fullSummaryV2';
import { createSupabaseClient } from './supabase';
import { getCurrentUser } from './auth';

/**
 * 전체 요약 v2 저장 (Supabase)
 */
export async function saveFullSummaryV2(documentId: string, summary: FullSummaryV2): Promise<void> {
  const supabase = createSupabaseClient();
  const user = await getCurrentUser();
  
  if (!user) {
    throw new Error('로그인이 필요합니다.');
  }

  // document_full_summaries 테이블에 저장
  // summary_content에 FullSummaryV2 JSON을 저장
  const { error } = await supabase
    .from('document_full_summaries')
    .upsert({
      document_id: documentId,
      summary_content: summary as any, // FullSummaryV2를 JSONB로 저장
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'document_id',
    });

  if (error) {
    console.error('전체 요약 저장 실패:', error);
    throw new Error(`전체 요약 저장에 실패했습니다: ${error.message}`);
  }
}

/**
 * 전체 요약 v2 조회 (Supabase)
 */
export async function fetchFullSummaryV2(documentId: string): Promise<FullSummaryV2 | null> {
  const supabase = createSupabaseClient();
  const user = await getCurrentUser();
  
  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from('document_full_summaries')
    .select('summary_content')
    .eq('document_id', documentId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // 데이터가 없음
      return null;
    }
    console.error('전체 요약 조회 실패:', error);
    return null;
  }

  // summary_content를 FullSummaryV2로 변환
  return data?.summary_content as FullSummaryV2 || null;
}

/**
 * PDF 텍스트 추출 (클라이언트에서 API 호출)
 */
export async function extractPdfText(storagePath: string): Promise<string> {
  try {
    const response = await fetch('/api/parse/pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storagePath }),
    });

    if (!response.ok) {
      throw new Error(`PDF 텍스트 추출 실패: ${response.status}`);
    }

    const data = await response.json();
    if (!data.pages || !Array.isArray(data.pages)) {
      throw new Error('페이지 데이터가 유효하지 않습니다.');
    }

    // 모든 페이지 텍스트를 합침
    const allText = data.pages
      .map((page: any, index: number) => `[페이지 ${index + 1}]\n${page.text || ''}`)
      .join('\n\n');

    return allText;
  } catch (error: any) {
    console.error('PDF 텍스트 추출 오류:', error);
    throw error;
  }
}

/**
 * 전체 요약 v2 생성 (AI)
 */
export async function generateFullSummaryV2(
  documentId: string,
  options: {
    pdfText?: string;
    storagePath?: string;
    professorSpeechText?: string;
  }
): Promise<FullSummaryV2> {
  let pdfText = options.pdfText;

  // PDF 텍스트가 없고 storagePath가 있으면 추출
  if (!pdfText && options.storagePath) {
    pdfText = await extractPdfText(options.storagePath);
  }

  if (!pdfText || pdfText.trim().length === 0) {
    throw new Error('PDF 텍스트가 비어있습니다.');
  }

  // API 호출
  const response = await fetch('/api/summarize/full-v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pdfText,
      professorSpeechText: options.professorSpeechText || '',
    }),
  });

  if (!response.ok) {
    let message = `전체 요약 생성 실패 (HTTP ${response.status})`;
    try {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const errorData = await response.json();
        const err = errorData?.error;
        const details = errorData?.details;
        if (err && details) message = `${err} (${details})`;
        else message = err || details || message;
      } else {
        const text = await response.text();
        message = text || message;
      }
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const data = await response.json();
  const summary: FullSummaryV2 = data.summary;

  // 저장
  await saveFullSummaryV2(documentId, summary);

  return summary;
}

/**
 * Mock 교수님 강조 포인트 생성 (개발용)
 */
export function generateMockProfessorEmphasis(): string {
  const mockPoints = [
    '시험에 자주 나오는 비교 포인트: A와 B의 차이점을 명확히 구분해야 함',
    '헷갈리기 쉬운 정의: 이 개념은 다른 개념과 혼동하지 않도록 주의',
    '중요한 계산식: 이 공식은 반드시 암기해야 하며, 시험에 자주 출제됨',
    '실무 적용 시 주의사항: 이론과 실제 적용 시 차이점이 있음',
  ];

  // 1~2개 랜덤 선택
  const count = Math.floor(Math.random() * 2) + 1;
  const selected = mockPoints
    .sort(() => Math.random() - 0.5)
    .slice(0, count)
    .join('\n');

  return selected;
}
