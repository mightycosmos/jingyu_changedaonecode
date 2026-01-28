import { NextRequest, NextResponse } from 'next/server';
import { geminiModel } from '@/lib/gemini';

export const runtime = 'nodejs';

function stripCodeFences(s: string): string {
  const trimmed = (s || '').trim();
  if (trimmed.startsWith('```')) {
    const firstNewline = trimmed.indexOf('\n');
    const lastFence = trimmed.lastIndexOf('```');
    if (firstNewline >= 0 && lastFence > firstNewline) {
      return trimmed.slice(firstNewline + 1, lastFence).trim();
    }
  }
  return trimmed;
}

function extractFirstJsonObject(s: string): string | null {
  const text = s || '';
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth++;
    if (ch === '}') depth--;
    if (depth === 0) {
      return text.slice(start, i + 1);
    }
  }
  return null;
}

function parseJsonLoose(text: string): any {
  const t1 = stripCodeFences(text);
  try {
    return JSON.parse(t1);
  } catch {
    const candidate = extractFirstJsonObject(t1);
    if (!candidate) throw new Error('응답에서 JSON 객체를 찾지 못했습니다.');
    return JSON.parse(candidate);
  }
}

const QUESTIONS_PROMPT = `
너는 대학 강의 보조 AI이다. 아래 "폴더 전체 요약"과 선택적 "족보 텍스트"를 기반으로
학생이 복습할 수 있는 문제 5개를 생성해라.

요구사항:
- 한국어로 작성
- 문제 수: 정확히 5개
- 각 문항: { question, answer, difficulty } JSON 형태 (difficulty는 "easy" | "medium" | "hard")
- 문제는 중복 없이 핵심 개념을 다양하게 커버
- 족보가 없으면 폴더 요약만 사용
- 출력은 반드시 application/json 하나 (설명/코드펜스/마크다운 금지)

출력 예시:
{ "questions": [ { "question": "...", "answer": "...", "difficulty": "medium" } ] }
`;

export async function POST(request: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY가 설정되어 있지 않습니다.' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const folderName: string = body?.folderName || '';
    const folderSummaryText: string = body?.folderSummaryText || '';
    const jokboText: string = body?.jokboText || '';

    if (!folderSummaryText || typeof folderSummaryText !== 'string' || folderSummaryText.trim().length === 0) {
      return NextResponse.json(
        { error: 'folderSummaryText가 비어 있습니다. 먼저 폴더 전체 요약을 생성해 주세요.' },
        { status: 400 }
      );
    }

    const res = await geminiModel.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: QUESTIONS_PROMPT },
            { text: `폴더명: ${folderName || '(폴더)'}` },
            { text: `폴더 전체 요약:\n${folderSummaryText}` },
            { text: `족보 텍스트 (없으면 "없음"): \n${jokboText || '없음'}` },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    } as any);

    const text = (await res.response).text();

    let parsed: any;
    try {
      parsed = parseJsonLoose(text);
    } catch (err: any) {
      return NextResponse.json(
        { error: '문제 생성에 실패했습니다.', details: err?.message || String(err) },
        { status: 500 }
      );
    }

    if (!parsed || !Array.isArray(parsed.questions)) {
      return NextResponse.json(
        {
          error: '유효한 questions 배열을 찾지 못했습니다.',
          details: typeof text === 'string' ? text.slice(0, 1000) : String(text),
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, questions: parsed.questions });
  } catch (e: any) {
    console.error('Question generation error:', e);
    return NextResponse.json(
      { error: '문제 생성에 실패했습니다.', details: e?.message || String(e) },
      { status: 500 }
    );
  }
}


