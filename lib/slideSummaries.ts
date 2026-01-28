import { getCurrentUser } from './auth';

export interface SlideSummary {
  id: string;
  document_id: string;
  slide_number: number;
  summary_content: any; // TipTap JSON 형식
  user_notes_content: any; // TipTap JSON 형식
  created_at: string;
  updated_at: string;
}

// LocalStorage Keys
const SUMMARIES_KEY = 'aone_summaries';

// Helper to get from LocalStorage
const getStoredItems = (key: string): any[] => {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : [];
};

// Helper to save to LocalStorage
const saveItems = (key: string, items: any[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(items));
};

/**
 * 슬라이드 요약을 조회합니다.
 */
export async function fetchSlideSummaries(documentId: string): Promise<SlideSummary[]> {
  const summaries = getStoredItems(SUMMARIES_KEY);
  return summaries
    .filter(s => s.document_id === documentId)
    .sort((a, b) => a.slide_number - b.slide_number);
}

/**
 * 슬라이드 요약을 저장/업데이트합니다.
 */
export async function saveSlideSummary(
  documentId: string,
  slideNumber: number,
  summaryContent: any, // TipTap JSON
  userNotesContent?: any // TipTap JSON
): Promise<SlideSummary> {
  const user = await getCurrentUser();
  if (!user) throw new Error('로그인이 필요합니다.');

  const summaries = getStoredItems(SUMMARIES_KEY);
  const index = summaries.findIndex(s => s.document_id === documentId && s.slide_number === slideNumber);
  const now = new Date().toISOString();

  if (index >= 0) {
    summaries[index] = {
      ...summaries[index],
      summary_content: summaryContent,
      user_notes_content: userNotesContent || summaries[index].user_notes_content,
      updated_at: now,
    };
    saveItems(SUMMARIES_KEY, summaries);
    return summaries[index];
  } else {
    const newSummary: SlideSummary = {
      id: crypto.randomUUID(),
      document_id: documentId,
      slide_number: slideNumber,
      summary_content: summaryContent,
      user_notes_content: userNotesContent || null,
      created_at: now,
      updated_at: now,
    };
    summaries.push(newSummary);
    saveItems(SUMMARIES_KEY, summaries);
    return newSummary;
  }
}

/**
 * 사용자 노트만 업데이트합니다.
 */
export async function updateUserNotes(
  documentId: string,
  slideNumber: number,
  userNotesContent: any // TipTap JSON
): Promise<SlideSummary> {
  const user = await getCurrentUser();
  if (!user) throw new Error('로그인이 필요합니다.');

  const summaries = getStoredItems(SUMMARIES_KEY);
  const index = summaries.findIndex(s => s.document_id === documentId && s.slide_number === slideNumber);
  const now = new Date().toISOString();

  if (index >= 0) {
    summaries[index] = {
      ...summaries[index],
      user_notes_content: userNotesContent,
      updated_at: now,
    };
    saveItems(SUMMARIES_KEY, summaries);
    return summaries[index];
  } else {
    const newSummary: SlideSummary = {
      id: crypto.randomUUID(),
      document_id: documentId,
      slide_number: slideNumber,
      summary_content: null,
      user_notes_content: userNotesContent,
      created_at: now,
      updated_at: now,
    };
    summaries.push(newSummary);
    saveItems(SUMMARIES_KEY, summaries);
    return newSummary;
  }
}

/**
 * AI를 사용하여 슬라이드 요약을 생성합니다.
 */
export async function summarizeSlideWithAI(
  storagePath: string,
  slideNumber: number,
  documentId: string,
  slideText?: string
): Promise<SlideSummary> {
  const response = await fetch('/api/summarize/slide', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storagePath, slideNumber, slideText }),
  });

  if (!response.ok) {
    let message = '슬라이드 요약에 실패했습니다.';
    try {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const errorData = await response.json();
        message = errorData?.error || errorData?.details || message;
      } else {
        const text = await response.text();
        message = text || message;
      }
    } catch {
      // ignore parse errors; fall back to generic message
    }
    throw new Error(message);
  }

  const data = await response.json();

  // 생성된 요약 저장
  return await saveSlideSummary(documentId, slideNumber, data.summary);
}

/**
 * AI를 사용하여 PDF 전체 슬라이드 요약을 한 번에 생성합니다.
 * (서버에서 PDF 파싱하지 않고, Gemini에게 PDF를 통째로 전달해 페이지별 요약을 받는 방식)
 */
export async function summarizeAllSlidesWithAI(
  storagePath: string,
  documentId: string
): Promise<SlideSummary[]> {
  const response = await fetch('/api/summarize/slides', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storagePath }),
  });

  if (!response.ok) {
    let message = `슬라이드 일괄 요약에 실패했습니다. (HTTP ${response.status})`;
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
  const summaries = Array.isArray(data?.summaries) ? data.summaries : [];

  // 로컬 저장 및 반환
  const saved: SlideSummary[] = [];
  for (const item of summaries) {
    const slideNumber = Number(item?.slide_number);
    if (!Number.isFinite(slideNumber) || slideNumber <= 0) continue;
    const summary = item?.summary ?? null;
    const row = await saveSlideSummary(documentId, slideNumber, summary);
    saved.push(row);
  }

  // slide_number 기준 정렬
  saved.sort((a, b) => a.slide_number - b.slide_number);
  return saved;
}

export interface ParsedPdfPage {
  slide_number: number;
  text: string;
}

/**
 * PDF를 페이지별로 텍스트 추출 + 클리닝한 결과를 반환합니다.
 */
export async function parsePdfPages(storagePath: string): Promise<{ numPages: number; pages: ParsedPdfPage[] }> {
  const response = await fetch('/api/parse/pages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storagePath }),
  });

  if (!response.ok) {
    let message = '페이지 텍스트 추출에 실패했습니다.';
    try {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const errorData = await response.json();
        message = errorData?.error || errorData?.details || message;
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
  return { numPages: data.numPages || 0, pages: Array.isArray(data.pages) ? data.pages : [] };
}

/**
 * AI를 사용하여 전체 요약을 생성합니다.
 */
export async function summarizeFullWithAI(
  documentId: string
): Promise<any> {
  // 슬라이드 요약 칸에 저장된 내용만을 기반으로 전체 요약(Reduce)을 생성합니다.
  // PDF 원본/페이지 텍스트는 사용하지 않습니다.
  const summaries = await fetchSlideSummaries(documentId);

  const tiptapToText = (node: any): string => {
    if (!node) return "";
    if (typeof node === "string") return node;
    if (typeof node.text === "string") return node.text;
    const content = Array.isArray(node.content) ? node.content : [];
    const parts = content.map(tiptapToText).filter(Boolean);
    return parts.join(" ");
  };

  const slidesText = summaries
    .map((s) => {
      const text = tiptapToText(s.summary_content).trim();
      if (!text) return null;
      return `Slide ${s.slide_number}:\n${text}`;
    })
    .filter(Boolean)
    .join("\n\n---\n\n");

  if (!slidesText || slidesText.trim().length === 0) {
    throw new Error("슬라이드 요약 내용이 비어있습니다. 먼저 '모든 슬라이드 요약하기'를 실행해 주세요.");
  }

  const response = await fetch('/api/summarize/full', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      slidesText,
    }),
  });

  if (!response.ok) {
    let message = `전체 요약에 실패했습니다. (HTTP ${response.status})`;
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

  // 전체 요약은 별도 테이블이나 필드에 저장해야 하지만, 우선 반환
  const fullSummaries = getStoredItems('aone_full_summaries');
  const index = fullSummaries.findIndex((s: any) => s.document_id === documentId);
  const now = new Date().toISOString();

  if (index >= 0) {
    fullSummaries[index] = { ...fullSummaries[index], content: data.summary, updated_at: now };
  } else {
    fullSummaries.push({ document_id: documentId, content: data.summary, updated_at: now });
  }
  saveItems('aone_full_summaries', fullSummaries);

  return data.summary;
}

/**
 * 전체 요약 조회
 */
export async function fetchFullSummary(documentId: string): Promise<any | null> {
  const fullSummaries = getStoredItems('aone_full_summaries');
  const found = fullSummaries.find((s: any) => s.document_id === documentId);
  return found ? found.content : null;
}

